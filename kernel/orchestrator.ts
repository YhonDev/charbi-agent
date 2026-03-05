// kernel/orchestrator.ts
// Orquestador central del kernel con Tool Calling Loop.
// Flujo: USER_REQUEST → Router → LLM (con tools) → ActionHandler → Response

import { eventBus, emitEvent } from './event_bus';
import { analyzeTask } from './router';
import { queryLLM } from './llm_connector';
import { executeAction, getAvailableTools } from './action_handlers';
import { v4 as uuidv4 } from 'uuid';
import { SkillRegistry } from './skill_registry';
import { cognitionLoader } from './cognition_loader';

import { contextBuilder } from './cognition/context_builder';

const MAX_COGNITIVE_STEPS = 10;

export class Orchestrator {
  constructor() {
    this.setupListeners();
    console.log('[Orchestrator] Online (Cognitive Loop Enabled)');
  }

  private setupListeners() {
    eventBus.on('USER_REQUEST', async (event: any) => {
      const origin = event.payload?.origin || event.origin || 'unknown';
      const { text, chatId } = event.payload;

      if (!text || !chatId) return;

      console.log(`[Orchestrator] Request from ${origin}: "${text}"`);

      try {
        const analysis = await analyzeTask(text);
        console.log(`[Orchestrator] Specialist: ${analysis.specialist} | Complexity: ${analysis.complexity}`);

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
            // as the LLM sees the observation and "thinks" again.
            continue;
          } else {
            // 5. RESPOND: No more tools, final answer
            finalResponse = content.replace(/\{[\s\S]*\}/, '').trim();
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
      type: 'AGENT_STATUS',
      timestamp: Date.now(),
      origin: 'orchestrator',
      payload: { chatId, status, message }
    });
  }

  private sendResponse(origin: string, chatId: string, text: string) {
    console.log(`[Orchestrator] Response to ${origin} (${text.length} chars)`);
    emitEvent({
      id: uuidv4(),
      type: 'AGENT_RESPONSE',
      timestamp: Date.now(),
      origin: 'orchestrator',
      payload: { text, chatId, channel: origin }
    });
  }
}

export default Orchestrator;
