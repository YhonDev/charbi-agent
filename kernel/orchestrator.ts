// kernel/orchestrator.ts
// Orquestador central del kernel con Tool Calling Loop.
// Flujo: USER_REQUEST → Router → LLM (con tools) → ActionHandler → Response

import { eventBus, emitEvent, EventType } from './event_bus';
import { analyzeTask, guessComplexity } from './router';
import { queryLLM } from './llm_connector';
import { executeAction, getAvailableTools } from './action_handlers';
import { v4 as uuidv4 } from 'uuid';
import { SkillRegistry } from './skill_registry';
import { cognitionLoader } from './cognition_loader';

import { contextBuilder } from './cognition/context_builder';
import { memoryClient } from './cognition/memory_client';
import { taskGraphEngine, Task } from './task_graph/task_graph_engine';

const MAX_COGNITIVE_STEPS = 10;
const COMPLEXITY_THRESHOLD = 0.15;

export class Orchestrator {
  private static instance: Orchestrator;

  private constructor() {
    this.setupListeners();
    console.log('[Orchestrator] Online (Cognitive Singleton Mode)');
  }

  public static getInstance(): Orchestrator {
    if (!Orchestrator.instance) {
      Orchestrator.instance = new Orchestrator();
    }
    return Orchestrator.instance;
  }

  private setupListeners() {
    eventBus.on(EventType.USER_REQUEST, async (event: any) => {
      const origin = event.payload?.origin || event.origin || 'unknown';
      const { text, chatId } = event.payload;

      if (!text || !chatId) return;

      console.log(`[Orchestrator] Request from ${origin}: "${text}"`);

      try {
        const analysis = await analyzeTask(text);
        console.log(`[Orchestrator] Specialist: ${analysis.specialist} | Complexity: ${analysis.complexity}`);

        // IMPROVED DECISION: Use heuristic as a safety floor for known action keywords
        const heuristicComplexity = guessComplexity(text);
        const finalComplexity = (analysis.complexity < 0.5 && heuristicComplexity > 0.5) ? heuristicComplexity : analysis.complexity;

        const complexityAnalysis = await taskGraphEngine.assessComplexity(text, event.id);

        if (complexityAnalysis.isComplex) {
          console.log(`[Orchestrator] Complex task detected (Score: ${complexityAnalysis.score}) → Creating TaskGraph...`);
          this.emitStatus(chatId, 'PLANNING', 'Planificando proyecto complejo...');

          // 1. Obtener historial reciente para el contexto
          let recentContext = '';
          try {
            const recentMemories = await memoryClient.call('memory.get_recent', { k: 10 });
            if (recentMemories && recentMemories.length > 0) {
              recentContext = recentMemories.map((m: any) => m.text).join('\n');
            }
          } catch (e) {
            console.warn('[Orchestrator] Error fetching context for TaskGraph:', e);
          }

          const graph = await taskGraphEngine.create(text, event.id, chatId, event.origin || origin, recentContext);

          // Vincular el chatId al grafo para respuestas (vía metadatos o correlationId)
          // El TaskGraphEngine ya emite eventos que el Gateway/Channels escuchan.

          const firstTask = taskGraphEngine.getNextTask(graph.id);
          if (firstTask) {
            taskGraphEngine.executeTask(firstTask, graph.id);
          }
          return;
        }

        const toolsSchema = JSON.stringify(getAvailableTools(), null, 2);

        // Multi-turn conversation for the cognitive loop
        let conversation: string[] = [`User: ${text}`];
        let finalResponse = '';
        let step = 0;

        while (step < MAX_COGNITIVE_STEPS) {
          step++;

          // 1. THINK: Context Assembly
          this.emitStatus(chatId, 'THINKING', `Ciclo cognitivo: Paso ${step}`);
          const systemPrompt = await contextBuilder.build({
            agentName: analysis.specialist,
            toolsSchema,
            userInput: text,
            history: conversation
          });

          const llmRes = await queryLLM(systemPrompt, conversation.join('\n'));
          if (!llmRes.success) {
            finalResponse = `⚠️ Error LLM: ${llmRes.error}`;
            break;
          }

          const content = (llmRes.content || '').trim();
          const parsed = this.parseCognitiveJSON(content);

          // Log Reasoning
          if (parsed && parsed.thought) {
            console.log(`[Orchestrator] Thought (${step}): ${parsed.thought.substring(0, 100)}...`);
            conversation.push(`Thought: ${parsed.thought}`);
            if (parsed.plan) conversation.push(`Plan: ${JSON.stringify(parsed.plan)}`);
          }

          // 2. ACT: Check for tool calls
          if (parsed && parsed.tool) {
            this.emitStatus(chatId, 'ACTING', `Ejecutando herramienta: ${parsed.tool}`);
            console.log(`[Orchestrator] Actuating: ${parsed.tool}`);

            const skillMetadata = SkillRegistry.getInstance().get(analysis.specialist);
            const permissions = skillMetadata?.manifest.permissions || ['filesystem.read', 'shell.execute', 'network.access'];

            // 3. OBSERVE: Execute tool and add result to context
            const result = await executeAction({
              type: parsed.tool,
              origin: `orchestrator:${analysis.specialist}`,
              params: parsed.params || {},
              permissions,
            });

            const resultStr = JSON.stringify(result.data || { error: result.error });
            conversation.push(`Observation (${parsed.tool}): ${resultStr}`);

            // 4. REFLECT: The next loop iteration will effectively be the reflection phase
            continue;
          } else {
            // 5. RESPOND: No more tools
            // SI LA TAREA REQUIERE HERRAMIENTAS Y NO SE HA USADO NINGUNA, FORZAR RE-RAZONAMIENTO
            if (analysis.requiresTools && step === 1 && !content.includes('{')) {
              console.warn('[Orchestrator] Direct response detected for action task. Forcing cognitive loop...');
              conversation.push("System: Has respondido directamente pero esta tarea requiere el uso de herramientas. PLANIFICA Y ACTUA usando el formato JSON.");
              continue;
            }

            finalResponse = content.replace(/\{[\s\S]*\}/, '').trim();
            // Fallback: Si no hay JSON pero hay contenido y hemos intentado forzarlo una vez, aceptamos el contenido
            if (!finalResponse && content && !content.includes('{')) {
              finalResponse = content;
            }
            if (!finalResponse && parsed && parsed.thought) {
              finalResponse = parsed.thought;
            }
            break;
          }
        }

        if (!finalResponse) finalResponse = '⚠️ No se pudo generar una respuesta.';

        // 6. LEARN: Post-task reflection and storage
        this.emitStatus(chatId, 'LEARNING', 'Extrayendo conocimientos de la tarea...');
        this.learnFromInteraction(text, finalResponse, conversation);

        this.sendResponse(origin, chatId, finalResponse);

      } catch (error: any) {
        console.error('[Orchestrator] Error:', error);
        this.sendResponse(origin, chatId, '❌ Error interno al procesar tu mensaje.');
      }
    });

    // Event listener for Tool Calls (emitted by TaskGraphEngine)
    eventBus.on(EventType.TOOL_CALLED, async (event: any) => {
      const { toolName, arguments: toolArgs, taskId, graphId } = event.payload;
      console.log(`[Orchestrator] Executing tool for TaskGraph: ${toolName} (${taskId})`);

      try {
        const result = await executeAction({
          type: toolName,
          origin: `task_graph:${graphId}`,
          params: toolArgs || {},
          permissions: ['filesystem.read', 'filesystem.write', 'shell.execute', 'network.access']
        });

        emitEvent({
          id: uuidv4(),
          type: EventType.TOOL_RESULT,
          timestamp: Date.now(),
          origin: 'orchestrator',
          payload: {
            graphId,
            taskId,
            result: result.data || result.error,
            success: result.success
          }
        });
      } catch (error: any) {
        console.error(`[Orchestrator] Tool execution error (${toolName}):`, error);
        emitEvent({
          id: uuidv4(),
          type: EventType.TOOL_RESULT,
          timestamp: Date.now(),
          origin: 'orchestrator',
          payload: {
            graphId,
            taskId,
            error: error.message,
            success: false
          }
        });
      }
    });
  }

  /** Procesa una tarea interna generada por el Task Graph Engine */
  async processInternalTask(task: Task, context?: string): Promise<any> {
    const toolsSchema = JSON.stringify(getAvailableTools(), null, 2);
    let conversation: string[] = [`Task Goal: ${task.description}`];
    if (context) conversation.push(context);
    let step = 0;

    console.log(`[Orchestrator] Agente ${task.agent} iniciando tarea: ${task.id}`);

    while (step < MAX_COGNITIVE_STEPS) {
      step++;

      const systemPrompt = await contextBuilder.build({
        agentName: task.agent,
        toolsSchema,
        userInput: task.description,
        history: conversation
      });

      const llmRes = await queryLLM(systemPrompt, conversation.join('\n'));
      if (!llmRes.success) throw new Error(llmRes.error);

      const content = (llmRes.content || '').trim();
      const parsed = this.parseCognitiveJSON(content);

      if (parsed && parsed.thought) {
        conversation.push(`Thought: ${parsed.thought}`);
      }

      if (parsed && parsed.tool) {
        const skillMetadata = SkillRegistry.getInstance().get(task.agent);
        const permissions = skillMetadata?.manifest.permissions || ['filesystem.read', 'shell.execute', 'network.access'];

        const result = await executeAction({
          type: parsed.tool,
          origin: `orchestrator:internal:${task.agent}`,
          params: parsed.params || {},
          permissions,
        });

        conversation.push(`Observation (${parsed.tool}): ${JSON.stringify(result.data || result.error)}`);
        continue; // Re-evaluar con el resultado
      } else {
        // Tarea terminada
        const result = content.replace(/\{[\s\S]*\}/, '').trim() || (parsed ? parsed.thought : content);
        console.log(`[Orchestrator] Internal task ${task.id} completed.`);
        return result;
      }
    }
  }

  /** Extrae aprendizajes y los persiste en la memoria híbrida */
  private async learnFromInteraction(input: string, output: string, history: string[]) {
    try {
      const learningPrompt = `
Eres el sistema de aprendizaje de Charbi. Analiza esta interacción y extrae:
1. Hechos nuevos sobre el usuario o el sistema.
2. Relaciones (Sujeto -> Relación -> Objeto).
3. Lecciones aprendidas (ej: "cuando el usuario pide X, prefiere Y").

INTERACCIÓN:
Usuario: ${input}
Charbi: ${output}
Historial detallado: ${history.join('\n')}

Responde únicamente con un objeto JSON:
{"learnings": ["..."], "relations": [{"s": "...", "r": "...", "o": "..."}]}
`;
      const res = await queryLLM(learningPrompt, "Sistema de Aprendizaje Activo");
      if (res.success && res.content) {
        const learned = this.parseCognitiveJSON(res.content);
        if (learned) {
          const { memoryManager } = await import('./cognition/memory_manager');

          // Guardar aprendizajes en memoria vectorial (vía bridge)
          for (const l of learned.learnings || []) {
            await memoryManager.store(l, 'learning');
          }

          // Guardar relaciones en el grafo
          for (const rel of learned.relations || []) {
            await memoryClient.call('graph.add_relation', {
              subject: rel.s,
              relation: rel.r,
              object: rel.o
            });
          }
          console.log(`[Orchestrator] Aprendizaje completado: ${learned.learnings?.length || 0} lecciones, ${learned.relations?.length || 0} relaciones.`);
        }
      }
    } catch (e) {
      console.error('[Orchestrator] Error en fase de aprendizaje:', e);
    }
  }

  private parseCognitiveJSON(content: string): any | null {
    try {
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (!braceMatch) return null;
      return JSON.parse(braceMatch[0]);
    } catch {
      return null;
    }
  }

  private emitStatus(chatId: string, status: string, message: string) {
    emitEvent({
      id: uuidv4(),
      type: EventType.AGENT_STATUS,
      timestamp: Date.now(),
      origin: 'orchestrator',
      payload: { chatId, status, message }
    });
  }

  private sendResponse(origin: string, chatId: string, text: string) {
    console.log(`[Orchestrator] Response to ${origin} (${text.length} chars)`);
    emitEvent({
      id: uuidv4(),
      type: EventType.AGENT_RESPONSE,
      timestamp: Date.now(),
      origin: 'orchestrator',
      payload: { text, chatId, channel: origin }
    });
  }
}

export default Orchestrator;
