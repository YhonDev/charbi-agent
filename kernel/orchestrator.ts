// kernel/orchestrator.ts
// Orquestador central del kernel con Tool Calling Loop.
// Flujo: USER_REQUEST → Router → LLM (con tools) → ActionHandler → Response

import { eventBus, emitEvent } from './event_bus';
import { analyzeTask } from './router';
import { queryLLM } from './llm_connector';
import { executeAction, getAvailableTools } from './action_handlers';
import { v4 as uuidv4 } from 'uuid';
import { SkillRegistry } from './skill_registry';

const MAX_TOOL_LOOPS = 5; // Máximo de iteraciones tool-calling

// Prompt del sistema con las herramientas disponibles (schemas estructurados)
function buildSystemPrompt(): string {
  const tools = getAvailableTools();
  const toolSchemas = JSON.stringify(tools, null, 2);

  return `Eres Charbi, un agente de IA operativo con acceso a herramientas del sistema.
Tu objetivo es ayudar al usuario realizando acciones reales cuando sea necesario.

HERRAMIENTAS DISPONIBLES (JSON Schema):
${toolSchemas}

INSTRUCCIONES DE USO:
1. Si necesitas realizar una acción, responde ÚNICAMENTE con la herramienta en formato JSON.
2. Formato de respuesta para herramientas:
{"tool": "nombre.herramienta", "params": {"param1": "valor1", ...}}

3. Ejemplos críticos:
- Para listar archivos: {"tool": "system.read", "params": {"path": "/home/yhondev/.charbi-agent"}}
- Para escribir: {"tool": "system.write", "params": {"path": "ejemplo.txt", "content": "hola"}}
- Para buscar: {"tool": "system.search", "params": {"query": "clima en medellin"}}

REGLAS:
- No inventes herramientas. Solo usa las listadas arriba.
- Si no necesitas herramientas, responde normalmente en texto plano (español).
- Después de una acción, analiza el resultado y finaliza la tarea.
- Sé conciso y eficiente.`;
}

export class Orchestrator {
  constructor() {
    this.setupListeners();
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

        // Tool calling loop
        const systemPrompt = buildSystemPrompt();
        let conversation = text;
        let finalResponse = '';

        for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
          const llmRes = await queryLLM(systemPrompt, conversation);

          if (!llmRes.success) {
            finalResponse = `⚠️ Error LLM: ${llmRes.error}`;
            break;
          }

          const content = (llmRes.content || '').trim();

          // Intentar parsear como tool call
          const toolCall = this.parseToolCall(content);

          if (toolCall) {
            console.log(`[Orchestrator] Tool call: ${toolCall.tool}(${JSON.stringify(toolCall.params)})`);

            // Obtener permisos reales de la skill
            const skillMetadata = SkillRegistry.getInstance().get(analysis.specialist);
            const permissions = skillMetadata?.manifest.permissions || [];

            // Ejecutar la herramienta
            const result = await executeAction({
              type: toolCall.tool,
              origin: `orchestrator:${analysis.specialist}`,
              params: toolCall.params,
              permissions,
            });

            console.log(`[Orchestrator] Tool result: ${result.success ? 'OK' : 'FAIL'}`);

            // Agregar resultado al contexto y volver a preguntar al LLM
            const resultStr = JSON.stringify(result.data || { error: result.error });
            conversation = `${text}\n\n[TOOL CALL: ${toolCall.tool}]\n[RESULT]: ${resultStr}\n\nAhora responde al usuario basándote en el resultado anterior.`;

          } else {
            // No es tool call → es la respuesta final
            finalResponse = content;
            break;
          }
        }

        if (!finalResponse) {
          finalResponse = '⚠️ No se pudo generar una respuesta.';
        }

        this.sendResponse(origin, chatId, finalResponse);

      } catch (error: any) {
        console.error('[Orchestrator] Error:', error);
        this.sendResponse(origin, chatId, '❌ Error interno al procesar tu mensaje.');
      }
    });
  }

  /** Intenta extraer un tool call de la respuesta del LLM */
  private parseToolCall(content: string): { tool: string; params: any } | null {
    try {
      // Limpiar: buscar JSON en el contenido
      let jsonStr = content;

      // Si viene envuelto en markdown ```json ... ```
      const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) jsonStr = codeBlock[1].trim();

      // Si viene después de </think>
      const thinkMatch = jsonStr.match(/<\/think>\s*([\s\S]*)/);
      if (thinkMatch) jsonStr = thinkMatch[1].trim();

      // Buscar el primer { ... } en el string
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!braceMatch) return null;

      const parsed = JSON.parse(braceMatch[0]);
      if (parsed.tool && typeof parsed.tool === 'string') {
        return { tool: parsed.tool, params: parsed.params || {} };
      }
    } catch {
      // No es JSON válido → no es un tool call
    }
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
