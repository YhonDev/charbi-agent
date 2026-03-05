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

import { promptBuilder } from './cognition/prompt_builder';

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

          // 1. THINK: Build prompt with memory and history
          const systemPrompt = promptBuilder.buildAgentPrompt({
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

          // 2. PARSE: Extract reasoning and tools
          const toolCall = this.parseToolCall(content);

          // Log thought if present
          const thoughtMatch = content.match(/\{[\s\S]*"thought"\s*:\s*"([\s\S]*?)"/);
          if (thoughtMatch) {
            console.log(`[Orchestrator] Thought (Step ${step}): ${thoughtMatch[1].substring(0, 100)}...`);
            conversation.push(`Thought: ${thoughtMatch[1]}`);
          }

          if (toolCall) {
            console.log(`[Orchestrator] Tool call (${step}): ${toolCall.tool}`);

            // 3. ACT: Execute tool
            const skillMetadata = SkillRegistry.getInstance().get(analysis.specialist);
            const permissions = skillMetadata?.manifest.permissions || ['filesystem.read', 'shell.execute', 'network.access'];

            const result = await executeAction({
              type: toolCall.tool,
              origin: `orchestrator:${analysis.specialist}`,
              params: toolCall.params,
              permissions,
            });

            // 4. OBSERVE: Add result to context
            const resultStr = JSON.stringify(result.data || { error: result.error });
            conversation.push(`Observation (${toolCall.tool}): ${resultStr}`);

            // Re-loop for reflection
            continue;
          } else {
            // Final response (remove JSON if any)
            finalResponse = content.replace(/\{[\s\S]*\}/, '').trim();
            if (!finalResponse && thoughtMatch) finalResponse = thoughtMatch[1];
            break;
          }
        }

        if (!finalResponse) finalResponse = '⚠️ No se pudo generar una respuesta.';
        this.sendResponse(origin, chatId, finalResponse);

      } catch (error: any) {
        console.error('[Orchestrator] Error:', error);
        this.sendResponse(origin, chatId, '❌ Error interno al procesar tu mensaje.');
      }
    });
  }

  private parseToolCall(content: string): { tool: string; params: any } | null {
    try {
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (!braceMatch) return null;

      const parsed = JSON.parse(braceMatch[0]);
      if (parsed.tool && typeof parsed.tool === 'string') {
        return { tool: parsed.tool, params: parsed.params || {} };
      }
    } catch { }
    return null;
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
