/**
 * 📋 Task Graph Engine - Planificador de Tareas Complejas
 * 
 * INTERACCIÓN CON:
 * - Kernel: Recibe eventos USER_REQUEST, emite eventos TASK_*
 * - LLM: Usa IntelligenceProxy para generar y validar tareas
 * - Tool Executor: Envía tareas para ejecución
 */

import { eventBus, KernelEvent as CharbiEvent, EventType } from '../event_bus';
import { IntelligenceProxy } from '../cognition/intelligence_proxy';
import { getAvailableTools } from '../action_handlers';
import { toolRegistry } from '../tool_registry';

// ═══════════════════════════════════════════════════════════════════════
// TIPOS Y INTERFACES
// ═══════════════════════════════════════════════════════════════════════

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  agent?: string;           // Agregado para compatibilidad con Orchestrator
  tool?: string;
  toolArgs?: object;
  result?: any;
  error?: string;
  dependencies?: string[];  // IDs de tareas que deben completarse primero
  retryCount: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface TaskGraph {
  id: string;
  objective: string;
  tasks: Task[];
  status: GraphStatus;
  createdAt: number;
  completedAt?: number;
  currentTaskIndex: number;
  correlationId: string;  // Para trazar desde el USER_REQUEST original
  metadata: {
    complexityScore: number;
    complexityReasons: string[];
    estimatedTasks: number;
    actualTasks: number;
    chatId: string;
    origin: string;
  };
}

export type GraphStatus =
  | 'planning'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'paused';

export interface ComplexityAnalysis {
  isComplex: boolean;
  confidence: number;  // 0-1
  score: number;       // 0-100
  reasons: string[];
  recommendedMode: 'chat' | 'react' | 'autonomous';
}

// ═══════════════════════════════════════════════════════════════════════
// TASK GRAPH ENGINE - SINGLETON
// ═══════════════════════════════════════════════════════════════════════

export class TaskGraphEngine {
  private static instance: TaskGraphEngine;

  private graphs: Map<string, TaskGraph> = new Map();
  private proxy: IntelligenceProxy;

  // Patrones que SIEMPRE requieren TaskGraph
  private readonly COMPLEX_PATTERNS = [
    /crea[r]?/i,                    // "crea", "crear"
    /desarrolla[r]?/i,              // "desarrolla", "desarrollar"
    /construir?|construye/i,           // "construye", "construir"
    /investiga[r]?/i,               // "investiga", "investigar"
    /analiza[r]?/i,                 // "analiza", "analizar"
    /compara[r]?/i,                 // "compara", "comparar"
    /múltiples/i,                   // "múltiples pasos"
    /varios/i,                      // "varias cosas"
    /paso.*paso/i,                  // "paso a paso"
    /primero.*después/i,            // "primero... después"
    /luego/i,                       // "luego haz esto"
    /web|sitio|página/i,            // "crea una web"
    /aplicación|app|programa/i,     // "crea una aplicación"
    /script|código|programa/i,      // "escribe un script"
    /archivo[s]?/i,                 // "crea varios archivos"
    /busca.*y.*crea/i,              // "busca y crea"
    /informe|reporte|documento/i,   // "genera un informe"
    /proyecto/i,                    // "trabaja en el proyecto"
    /archivo[s]?|página[s]?|componente[s]?|parte[s]?|módulo[s]?/i,
    /crea.*proyecto|create.*project|build.*app/i, // ✅ Project patterns
    /explica.*código|explain.*code|tutorial|guide/i, // ✅ Explanation + code
    /\by\b.*\by\b|\bthen\b|\bdespués\b|\blets\b/i // ✅ Multi-step connectors
  ];

  // Umbrales de complejidad
  private readonly THRESHOLDS = {
    MIN_PATTERN_MATCHES: 1,
    MIN_WORDS_FOR_COMPLEX: 15,
    MIN_ACTION_VERBS: 1,
    COMPLEXITY_SCORE: 25, // ✅ Lower threshold (from 40)
  };

  private constructor() {
    this.proxy = IntelligenceProxy.getInstance();
    this.registerEventHandlers();
  }

  static getInstance(): TaskGraphEngine {
    if (!TaskGraphEngine.instance) {
      TaskGraphEngine.instance = new TaskGraphEngine();
    }
    return TaskGraphEngine.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REGISTRO DE EVENTOS - INTERACCIÓN CON KERNEL
  // ═══════════════════════════════════════════════════════════════════════

  private registerEventHandlers(): void {
    // Escuchar cuando una tarea se completa
    eventBus.on(EventType.TASK_COMPLETED, async (event: CharbiEvent) => {
      await this.handleTaskComplete(event);
    });

    // Escuchar cuando una tarea falla
    eventBus.on(EventType.TASK_FAILED, async (event: CharbiEvent) => {
      await this.handleTaskFail(event);
    });

    // Escuchar cuando hay resultado de herramienta
    eventBus.on(EventType.TOOL_RESULT, async (event: CharbiEvent) => {
      await this.handleToolResult(event);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS DE UTILIDAD (PATHS, TOOLS, FALLBACKS)
  // ═══════════════════════════════════════════════════════════════════════

  /** Formatea las herramientas para el prompt del LLM */
  private formatToolsForPrompt(tools: any[]): string {
    return tools.map(tool => `
- ${tool.name}: ${tool.description}
  Parameters: ${JSON.stringify(tool.parameters)}
`).join('\n');
  }

  /** Garantiza que una ruta sea absoluta para WSL */
  private ensureAbsolutePath(filePath: string): string {
    if (!filePath) return filePath;
    if (filePath.startsWith('/')) return filePath;
    if (filePath.startsWith('~/')) return filePath.replace(/^~/, process.env.HOME || require('os').homedir());

    // Resolve relative paths from HOME instead of a rigid workspace folder
    const baseDir = process.env.HOME || require('os').homedir();
    const cleanPath = filePath.replace(/^\.?\//, '');
    return `${baseDir}/${cleanPath}`;
  }

  /** Tareas de respaldo si el LLM falla */
  private getFallbackTasks(objective: string): Task[] {
    console.log('[TaskGraph] Using fallback tasks');
    return [{
      id: 'task_1',
      description: `Execute objective: ${objective}`,
      tool: 'system.read', // Herramienta de lectura básica como fallback
      toolArgs: { path: '/home/yhondev/.charbi-agent' },
      status: 'pending',
      dependencies: [],
      retryCount: 0,
      createdAt: Date.now(),
    }];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 1: EVALUACIÓN DE COMPLEJIDAD
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Evalúa si una tarea requiere TaskGraph
   * Esto se llama DESPUÉS de recibir USER_REQUEST del Event Bus
   */
  async assessComplexity(prompt: string, correlationId: string): Promise<ComplexityAnalysis> {
    console.log('[TaskGraph] 🔍 START: assessComplexity');
    console.log('[TaskGraph] Prompt:', prompt.substring(0, 100));

    try {
      // Skip assessment if it's already an internal task (to avoid recursion)
      if (correlationId?.startsWith('task_') || correlationId?.startsWith('internal_') || correlationId?.includes('task_graph')) {
        const skipResult: ComplexityAnalysis = { isComplex: false, confidence: 1, score: 0, reasons: ['Internal task'], recommendedMode: 'chat' };
        console.log('[TaskGraph] ✅ END: assessComplexity (Internal Task Skip)');
        return skipResult;
      }

      const reasons: string[] = [];
      let score = 0;

      // 1. Contar patrones de complejidad
      const patternMatches = this.COMPLEX_PATTERNS.filter(pattern =>
        pattern.test(prompt)
      );

      if (patternMatches.length >= this.THRESHOLDS.MIN_PATTERN_MATCHES) {
        score += 40;
        reasons.push(`Contains ${patternMatches.length} complex pattern(s): ${patternMatches.map(p => p.source).join(', ')}`);
      }

      // 2. Longitud del prompt
      const wordCount = prompt.split(/\s+/).length;
      if (wordCount >= this.THRESHOLDS.MIN_WORDS_FOR_COMPLEX) {
        score += 20;
        reasons.push(`Long prompt (${wordCount} words)`);
      }

      // 3. Múltiples verbos de acción
      const actionVerbs = prompt.match(/(crea|desarrolla|construye|investiga|analiza|busca|escribe|genera|configura|instala)/gi);
      if (actionVerbs && actionVerbs.length >= this.THRESHOLDS.MIN_ACTION_VERBS) {
        score += 30;
        reasons.push(`Multiple actions (${actionVerbs.length} verbs): ${actionVerbs.join(', ')}`);
      }

      // 4. Mencionar múltiples archivos/componentes
      if (/archivo[s]?|página[s]?|componente[s]?|parte[s]?|módulo[s]?/i.test(prompt)) {
        score += 20;
        reasons.push('Multiple components mentioned');
      }

      // 5. Palabras de secuencia
      if (/primero|luego|después|finalmente|paso|entonces|posteriormente/i.test(prompt)) {
        score += 15;
        reasons.push('Sequential steps mentioned');
      }

      // 6. Usar LLM para evaluar complejidad (Solo si el score es bajo)
      if (score < this.THRESHOLDS.COMPLEXITY_SCORE) {
        const llmAssessment = await this.assessComplexityWithLLM(prompt);
        if (llmAssessment.isComplex) {
          score += 40;
          reasons.push(`LLM Assessment: ${llmAssessment.reasons.join(', ')}`);
        }
      }

      const isComplex = score >= this.THRESHOLDS.COMPLEXITY_SCORE;
      console.log(`[TaskGraph] Score: ${score} | isComplex: ${isComplex}`);

      // Determinar modo recomendado
      let recommendedMode: 'chat' | 'react' | 'autonomous' = 'chat';
      if (score >= 60) recommendedMode = 'autonomous';
      else if (score >= 25) recommendedMode = 'react';

      const analysis: ComplexityAnalysis = {
        isComplex,
        confidence: Math.min(score / 50, 1),
        score,
        reasons,
        recommendedMode
      };

      console.log(`[TaskGraph] Complexity: ${analysis.isComplex ? 'COMPLEX' : 'SIMPLE'} (${analysis.score} points, ${analysis.confidence.toFixed(2)} confidence)`);

      // Emitir evento para que CLI muestre progreso
      eventBus.emit('COMPLEXITY_ANALYSIS', {
        id: `ev_${Date.now()}`,
        type: 'COMPLEXITY_ANALYSIS',
        timestamp: Date.now(),
        payload: analysis,
        origin: 'TaskGraphEngine'
      });

      console.log('[TaskGraph] ✅ END: assessComplexity', analysis.isComplex ? 'COMPLEX' : 'SIMPLE', `(Score: ${score})`);
      return analysis;
    } catch (error) {
      console.error('[TaskGraph] ❌ ERROR: assessComplexity', error);
      throw error;
    }
  }

  /**
   * Usa el LLM para evaluar complejidad (más preciso pero más lento)
   */
  private async assessComplexityWithLLM(prompt: string): Promise<{ isComplex: boolean; reasons: string[] }> {
    const assessmentPrompt = `
Analyze if this user request requires multi-step planning:

REQUEST: "${prompt}"

Criteria for complex tasks:
- Requires multiple files to be created
- Requires research before execution
- Has multiple distinct steps
- Requires coordination between different tools
- Has dependencies between steps

Respond in JSON format:
{
  "isComplex": true|false,
  "reasons": ["reason1", "reason2"]
}
`;

    try {
      const response = await this.proxy.generate(assessmentPrompt, {
        mode: 'analysis',
        systemPrompt: "Eres un analista de complejidad de tareas. Responde solo en JSON."
      });

      let content = response.content.trim();
      const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) content = m[1].trim();

      const parsed = JSON.parse(content);
      return {
        isComplex: parsed.isComplex || false,
        reasons: parsed.reasons || [],
      };
    } catch (error) {
      console.warn('[TaskGraph] LLM complexity assessment failed:', error);
      return { isComplex: false, reasons: [] };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 2: CREACIÓN DEL TASK GRAPH
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Crea el TaskGraph usando el LLM para descomponer la tarea
   * Esto se llama DESPUÉS de determinar que es complejo
   */
  async create(objective: string, correlationId: string, chatId: string, origin: string, context?: string): Promise<TaskGraph> {
    const startTime = Date.now();
    console.log('[TaskGraph] 🔍 START: create TaskGraph');
    console.log('[TaskGraph] Objective:', objective.substring(0, 100));
    console.log('[TaskGraph] CorrelationID:', correlationId);

    try {
      const graph: TaskGraph = {
        id: `tg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        objective,
        tasks: [],
        status: 'planning',
        createdAt: Date.now(),
        currentTaskIndex: 0,
        correlationId,
        metadata: {
          complexityScore: 0,
          complexityReasons: [],
          estimatedTasks: 0,
          actualTasks: 0,
          chatId,
          origin,
        },
      };

      // Emitir evento: Inicio de planificación
      eventBus.emit(EventType.AGENT_THINK, {
        id: `ev_${Date.now()}`,
        type: EventType.AGENT_THINK,
        timestamp: Date.now(),
        payload: {
          graphId: graph.id,
          objective,
          correlationId,
          status: 'planning'
        },
        origin: 'TaskGraphEngine'
      });

      // Generar tareas usando el LLM (pasando el contexto)
      const tasks = await this.generateTasksWithLLM(objective, correlationId, context);

      if (tasks.length === 0) {
        // Fallback: crear tarea única
        console.warn('[TaskGraph] LLM generated no tasks, creating fallback task');
        graph.tasks.push({
          id: `task_1`,
          description: objective,
          status: 'pending',
          agent: 'main', // Asignar agente por defecto para el orquestador
          retryCount: 0,
          createdAt: Date.now(),
        });
      } else {
        graph.tasks = tasks;
      }

      graph.metadata.estimatedTasks = graph.tasks.length;
      graph.metadata.actualTasks = graph.tasks.length;
      graph.status = 'executing';

      // Guardar en memoria
      this.graphs.set(graph.id, graph);

      // Emitir evento: TaskGraph creado
      eventBus.emit(EventType.TASK_CREATED, {
        id: `ev_${Date.now()}`,
        type: EventType.TASK_CREATED,
        timestamp: Date.now(),
        payload: {
          graphId: graph.id,
          tasks: graph.tasks.map(t => ({
            id: t.id,
            description: t.description,
            tool: t.tool,
            status: t.status,
          })),
          totalTasks: graph.tasks.length,
          correlationId,
        },
        origin: 'TaskGraphEngine'
      });

      console.log(`[TaskGraph] Created with ${graph.tasks.length} tasks`);
      console.log(`[TaskGraph] ✅ END: create TaskGraph ${graph.id} with ${graph.tasks.length} tasks`);
      return graph;
    } catch (error) {
      console.error('[TaskGraph] ❌ ERROR: create TaskGraph', error);
      throw error;
    }
  }

  /**
   * Usa el LLM para descomponer la tarea en pasos
   */
  private async generateTasksWithLLM(objective: string, correlationId: string, context?: string): Promise<Task[]> {
    const startTime = Date.now();
    console.log(`[TaskGraph] 🧠 START: generateTasksWithLLM for ${correlationId}`);

    const availableTools = getAvailableTools();
    const toolsSchema = JSON.stringify(availableTools, null, 2);

    const prompt = `
Objective: ${objective}
${context ? `Context/Memory:\n${context}` : ''}

Available Tools:
${toolsSchema}

Decompose this objective into a series of logical tasks.
Each task must be in JSON format:
{
  "tasks": [
    {
      "description": "Short explanation",
      "tool": "tool_name",
      "toolArgs": { ...args },
      "dependencies": ["task_id_of_previous"]
    }
  ]
}

RULES:
1. Return ONLY valid JSON.
2. Use tools whenever possible.
3. If no tool is available, leave "tool" null.
4. Set "agent": "coder" for coding tasks.
`;

    try {
      const res = await this.proxy.generate(prompt, {
        mode: 'planning',
        jsonMode: true,
        correlationId
      });

      const parsed = res.raw || {};

      // ✅ FIX 3: Validar tool names contra registry y rutas absolutas
      const tasks = parsed.tasks.map((task: any, index: number) => {
        const toolExists = toolRegistry.getTool(task.tool);

        if (task.tool && !toolExists) {
          console.warn('[TaskGraph] ⚠️ Unknown tool:', task.tool, '- Using system.read as fallback');
          task.tool = 'system.read'; // Fallback seguro
        }

        // ✅ FIX 4: Convertir rutas relativas a absolutas
        if (task.toolArgs?.path) {
          task.toolArgs.path = this.ensureAbsolutePath(task.toolArgs.path);
        }

        return {
          id: `task_${index + 1}`,
          description: task.description || objective,
          tool: task.tool,
          toolArgs: task.toolArgs || {},
          dependencies: task.dependencies || [],
          status: 'pending' as TaskStatus,
          retryCount: 0,
          createdAt: Date.now(),
        };
      });

      console.log(`[TaskGraph] ✅ END: generateTasksWithLLM (${tasks.length} tasks generated in ${Date.now() - startTime}ms)`);
      return tasks;

    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`[TaskGraph] ❌ ERROR: generateTasksWithLLM after ${elapsed}ms:`, error);
      return this.getFallbackTasks(objective);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 3: EJECUCIÓN DE TAREAS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Obtiene la siguiente tarea lista para ejecutar
   */
  getNextTask(graphId: string): Task | null {
    const graph = this.graphs.get(graphId);
    if (!graph) return null;

    for (let i = 0; i < graph.tasks.length; i++) {
      const task = graph.tasks[i];

      if (task.status === 'pending') {
        const depsCompleted = task.dependencies?.every(depId => {
          const depTask = graph.tasks.find(t => t.id === depId);
          return depTask?.status === 'completed';
        }) ?? true;

        if (depsCompleted) {
          task.status = 'in_progress';
          task.startedAt = Date.now();
          graph.currentTaskIndex = i;

          eventBus.emit(EventType.TASK_STARTED, {
            id: `ev_${Date.now()}`,
            type: EventType.TASK_STARTED,
            timestamp: Date.now(),
            payload: {
              graphId,
              taskId: task.id,
              taskIndex: i + 1,
              totalTasks: graph.tasks.length,
              description: task.description,
              tool: task.tool,
              correlationId: graph.correlationId,
            },
            origin: 'TaskGraphEngine'
          });

          return task;
        }
      }
    }
    return null;
  }

  /**
   * Ejecuta una tarea
   */
  executeTask(task: Task, graphId: string): void {
    // Si la tarea no tiene herramienta asignada o sus argumentos tienen placeholders generados por LLM (<...>)
    const hasPlaceholders = task.toolArgs ? /<[^>]+>/.test(JSON.stringify(task.toolArgs)) : false;

    if (!task.tool || hasPlaceholders) {
      if (hasPlaceholders) console.log(`[TaskGraph] Placeholder detected in args, escalating task ${task.id} to dynamic LLM execution`);
      this.executeTaskWithLLM(task, graphId);
      return;
    }

    eventBus.emit(EventType.TOOL_CALLED, {
      id: `ev_${Date.now()}`,
      type: EventType.TOOL_CALLED,
      timestamp: Date.now(),
      payload: {
        toolName: task.tool,
        arguments: task.toolArgs,
        taskId: task.id,
        graphId,
        correlationId: this.graphs.get(graphId)?.correlationId || '',
      },
      origin: 'TaskGraphEngine'
    });
  }

  private async executeTaskWithLLM(task: Task, graphId: string): Promise<void> {
    const graph = this.graphs.get(graphId);
    const correlationId = graph?.correlationId || task.id;
    console.log(`[TaskGraph] 🤖 START: executeTaskWithLLM (${task.id}) for ${correlationId}`);

    const completedTasks = graph?.tasks.filter(t => t.status === 'completed' && t.result) || [];
    const previousContext = completedTasks.length > 0
      ? `\n--- PREVIOUS TASKS RESULTS ---\n` + completedTasks.map(t => `Task: ${t.description}\nResult: ${typeof t.result === 'string' ? t.result.substring(0, 1000) : JSON.stringify(t.result).substring(0, 1000)}`).join('\n\n') + `\n------------------------------\n`
      : '';

    const availableTools = getAvailableTools();
    const toolsSchema = JSON.stringify(availableTools, null, 2);

    const prompt = `
Objective: ${graph?.objective}
${previousContext}

Available Tools:
${toolsSchema}

Current Task: ${task.description}
Task ID: ${task.id}

Execute this task based on the objective and the results of previous tasks. 
If you need to use a tool to accomplish this, respond with the EXACT tool call in JSON format:
{ "tool": "tool_name", "params": { "arg1": "value" } }
`;

    try {
      const response = await this.proxy.generate(prompt, {
        mode: 'execution',
        correlationId
      });

      // Si el LLM devolvió un tool call (o texto que parece JSON)
      const content = response.content.trim();
      const match = content.match(/\{[\s\S]*\}/);

      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.tool) {
            console.log(`[TaskGraph] 🛠️ LLM decided to use tool during task execution: ${parsed.tool}`);

            // Emitir TOOL_CALLED para que el orquestador lo ejecute
            eventBus.emit(EventType.TOOL_CALLED, {
              id: `ev_${Date.now()}`,
              type: EventType.TOOL_CALLED,
              timestamp: Date.now(),
              payload: {
                toolName: parsed.tool,
                arguments: parsed.params || parsed.args || {},
                taskId: task.id,
                graphId,
                correlationId: graph.correlationId,
              },
              origin: 'TaskGraphEngine'
            });
            return; // No completamos la tarea aún, esperamos al TOOL_RESULT
          }
        } catch (e) {
          console.warn('[TaskGraph] Failed to parse internal LLM tool call, treat as message');
        }
      }

      this.completeTask(graphId, task.id, response.content);
    } catch (error: any) {
      this.failTask(graphId, task.id, error.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 4: COMPLETADO / FALLIDO
  // ═══════════════════════════════════════════════════════════════════════

  completeTask(graphId: string, taskId: string, result: any): void {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      console.error('[TaskGraph] ❌ Graph not found:', graphId);
      return;
    }

    const task = graph.tasks.find(t => t.id === taskId);
    if (!task) {
      console.error('[TaskGraph] ❌ Task not found:', taskId);
      return;
    }

    // ✅ LOGGING DETALLADO
    console.log('[TaskGraph] ✅ Completing task:', {
      graphId,
      taskId,
      taskDescription: task.description,
      tool: task.tool,
      result: JSON.stringify(result).substring(0, 200)
    });

    // ✅ VERIFICAR SI EL RESULTADO INDICA ERROR
    if (result?.error || result?.success === false) {
      console.warn('[TaskGraph] ⚠️ Tool reported error:', result.error || result.data?.error);
      this.failTask(graphId, taskId, result.error || result.data?.error || 'Tool execution failed');
      return;
    }

    task.status = 'completed';
    task.result = result;
    task.completedAt = Date.now();

    eventBus.emit(EventType.TASK_COMPLETED, {
      id: `ev_${Date.now()}`,
      type: EventType.TASK_COMPLETED,
      timestamp: Date.now(),
      payload: {
        graphId,
        taskId,
        result,
        correlationId: graph.correlationId,
      },
      origin: 'TaskGraphEngine'
    });

    const allCompleted = graph.tasks.every(t => t.status === 'completed' || t.status === 'skipped');
    if (allCompleted) {
      this.completeGraph(graphId);
    }
  }

  failTask(graphId: string, taskId: string, error: any): void {
    const graph = this.graphs.get(graphId);
    if (!graph) return;

    const task = graph.tasks.find(t => t.id === taskId);
    if (!task) return;

    const errorMsg = typeof error === 'object' ? JSON.stringify(error) : String(error);

    task.status = 'failed';
    task.error = errorMsg;
    task.retryCount++;

    console.error('[TaskGraph] ❌ Task failed:', {
      graphId,
      taskId,
      errorMsg,
      retryCount: task.retryCount
    });

    eventBus.emit(EventType.TASK_FAILED, {
      id: `ev_${Date.now()}`,
      type: EventType.TASK_FAILED,
      timestamp: Date.now(),
      payload: {
        graphId,
        taskId,
        error: errorMsg,
        canRetry: task.retryCount < 3,
        retryCount: task.retryCount,
        correlationId: graph.correlationId,
      },
      origin: 'TaskGraphEngine'
    });

    // ✅ LÓGICA DE REINTENTO
    if (task.retryCount < 3) {
      console.log('[TaskGraph] 🔄 Retrying task:', taskId, '(attempt', task.retryCount + 1, ')');

      // Resetear estado para reintentar con backoff exponencial
      setTimeout(() => {
        task.status = 'pending';
        task.error = undefined;

        const next = this.getNextTask(graphId);
        if (next) this.executeTask(next, graphId);
      }, 1000 * task.retryCount);
    } else {
      console.error('[TaskGraph] ❌ Task failed after 3 retries:', taskId);
      this.failGraph(graphId, `Task ${task.id} failed after 3 tries: ${errorMsg}`);
    }
  }

  completeGraph(graphId: string): void {
    const graph = this.graphs.get(graphId);
    if (!graph) return;

    graph.status = 'completed';
    graph.completedAt = Date.now();

    // ✅ Propagar resultados reales para que el orquestador genere el resumen
    const toolResults = graph.tasks.map(t => ({
      id: t.id,
      description: t.description,
      tool: t.tool,
      success: t.status === 'completed',
      result: typeof t.result === 'string' ? t.result.substring(0, 500) : t.result,
    }));

    eventBus.emit(EventType.TASK_GRAPH_COMPLETED as any, {
      id: `ev_${Date.now()}`,
      type: EventType.TASK_GRAPH_COMPLETED,
      timestamp: Date.now(),
      payload: {
        graphId,
        objective: graph.objective,
        toolResults,
        correlationId: graph.correlationId,
        chatId: graph.metadata.chatId,
        origin: graph.metadata.origin,
      },
      origin: 'TaskGraphEngine'
    });
  }

  failGraph(graphId: string, error: string): void {
    const graph = this.graphs.get(graphId);
    if (!graph) return;

    graph.status = 'failed';
    graph.completedAt = Date.now();

    eventBus.emit(EventType.AGENT_RESPONSE, {
      id: `ev_${Date.now()}`,
      type: EventType.AGENT_RESPONSE,
      timestamp: Date.now(),
      payload: {
        graphId,
        text: `❌ Error en el proyecto: ${error}`,
        error,
        correlationId: graph.correlationId,
        chatId: graph.metadata.chatId,
        origin: graph.metadata.origin,
        status: 'failed'
      },
      origin: 'TaskGraphEngine'
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Obtiene un grafo por su ID
   */
  getGraph(graphId: string): TaskGraph | undefined {
    return this.graphs.get(graphId);
  }

  /**
   * Elimina un grafo del motor
   */
  cleanup(graphId: string): void {
    this.graphs.delete(graphId);
    console.log(`[TaskGraph] Cleanup: Graph ${graphId} removed.`);
  }

  private async handleTaskComplete(event: CharbiEvent): Promise<void> {
    if (event.origin === 'TaskGraphEngine') return; // Evitar loops
    const { graphId, taskId, result } = event.payload;
    if (graphId && taskId) {
      this.completeTask(graphId, taskId, result);
      const next = this.getNextTask(graphId);
      if (next) this.executeTask(next, graphId);
    }
  }

  private async handleTaskFail(event: CharbiEvent): Promise<void> {
    if (event.origin === 'TaskGraphEngine') return;
    const { graphId, taskId, error, canRetry } = event.payload;
    if (graphId && taskId && canRetry) {
      const task = this.graphs.get(graphId)?.tasks.find(t => t.id === taskId);
      if (task) {
        task.status = 'pending';
        this.executeTask(task, graphId);
      }
    }
  }

  private async handleToolResult(event: CharbiEvent): Promise<void> {
    const { graphId, taskId, result, success } = event.payload;
    if (graphId && taskId) {
      if (success === false) {
        console.warn(`[TaskGraph] Tool failed for task ${taskId}:`, result);
        this.failTask(graphId, taskId, result || 'Unknown tool error');
        return;
      }

      this.completeTask(graphId, taskId, result);
      const next = this.getNextTask(graphId);
      if (next) this.executeTask(next, graphId);
    }
  }
}

export const taskGraphEngine = TaskGraphEngine.getInstance();
export default taskGraphEngine;
