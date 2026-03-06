import { log } from '../logger';
import { queryLLM } from '../llm_connector';
import { v4 as uuidv4 } from 'uuid';
import { DebugTracker } from '../debug/debug_tracker';

/**
 * 🧠 Intelligence Proxy - Puerta de enlace para el LLM
 * Abstrae la complejidad de las llamadas al modelo y proporciona una interfaz consistente.
 */
export class IntelligenceProxy {
  private static instance: IntelligenceProxy;

  private constructor() { }

  static getInstance(): IntelligenceProxy {
    if (!IntelligenceProxy.instance) {
      IntelligenceProxy.instance = new IntelligenceProxy();
    }
    return IntelligenceProxy.instance;
  }

  /**
   * Genera una respuesta basada en un prompt y opciones.
   */
  async generate(prompt: string, options: any = {}): Promise<{ content: string; toolCalls?: any[]; raw?: any }> {
    const mode = options.mode || 'chat';
    const systemPrompt = options.systemPrompt || "Eres Charbi, un asistente autónomo altamente capaz.";

    // ✅ ENHANCED JSON FORCING (as suggested by senior dev)
    let finalPrompt = prompt;
    if (options.jsonMode) {
      finalPrompt = `
IMPORTANT: You MUST respond in valid JSON format. Do not include markdown or explanations outside the JSON.

RESPONSE FORMAT:
{
  "thought": "brief reasoning",
  "tool": "tool_name (optional)",
  "params": { ...args (optional) },
  "response": "final message if no tool is needed"
}

NOW RESPOND TO:
${prompt}

JSON:`;
    }

    log({
      level: 'INFO',
      module: 'IntelligenceProxy',
      message: `Generating response for mode: ${mode}`,
      data: { promptLength: finalPrompt.length, jsonMode: !!options.jsonMode }
    });

    const timeout = options.timeout || 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res: any = await Promise.race([
        queryLLM(systemPrompt, finalPrompt, options),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('LLM_TIMEOUT')), timeout))
      ]);

      clearTimeout(timeoutId);

      if (!res.success) {
        throw new Error(`LLM Error: ${res.error}`);
      }

      let content = res.content;
      const correlationId = options.correlationId || 'unknown';

      // ✅ LOG RAW RESPONSE FOR DEBUG
      DebugTracker.getInstance().track({
        timestamp: Date.now(),
        type: 'LLM_RAW_RESPONSE',
        correlationId,
        payload: {
          contentLength: content.length,
          mode,
          jsonMode: !!options.jsonMode
        },
        raw: content
      });

      // ✅ ROBUST JSON PARSING
      if (options.jsonMode) {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              content: parsed.response || parsed.thought || content,
              toolCalls: parsed.tool ? [{ name: parsed.tool, arguments: parsed.params || {} }] : [],
              raw: parsed
            };
          }
        } catch (e: any) {
          console.warn(`[IntelligenceProxy] Failed to parse JSON match for ${correlationId}:`, e.message);
          DebugTracker.getInstance().track({
            timestamp: Date.now(),
            type: 'LLM_PARSE_ERROR',
            correlationId,
            payload: { error: e.message, preview: content.substring(0, 200) }
          });
        }
      }

      return {
        content,
        toolCalls: res.usage?.toolCalls
      };
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.message === 'LLM_TIMEOUT') {
        log({ level: 'ERROR', module: 'IntelligenceProxy', message: `LLM timeout after ${timeout}ms` });
      }
      throw e;
    }
  }
}

export default IntelligenceProxy;
