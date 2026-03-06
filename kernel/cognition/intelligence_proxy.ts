import { log } from '../logger';
import { queryLLM } from '../llm_connector';

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
  async generate(prompt: string, options: any = {}): Promise<{ content: string; toolCalls?: any[] }> {
    const systemPrompt = options.systemPrompt || "Eres Charbi, un asistente autónomo altamente capaz.";

    log({
      level: 'INFO',
      module: 'IntelligenceProxy',
      message: `Generating response for mode: ${options.mode || 'chat'}`,
      data: { promptLength: prompt.length }
    });

    // Default timeout of 60 seconds
    const timeout = options.timeout || 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // We use Promise.race to enforce the timeout even if queryLLM doesn't support AbortSignal yet
      const res: any = await Promise.race([
        queryLLM(systemPrompt, prompt),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('LLM_TIMEOUT')), timeout))
      ]);

      clearTimeout(timeoutId);

      if (!res.success) {
        throw new Error(`LLM Error: ${res.error}`);
      }

      return {
        content: res.content,
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
