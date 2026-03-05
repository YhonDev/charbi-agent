// providers/groq.ts
// Proveedor de LLM para Groq (Llama 3, Mixtral) compatible con la interfaz de Charbi.
// Usa una implementación compatible con OpenAI.

import { Provider, LLMResponse } from '../kernel/providers/provider_interface';
import https from 'https';

class GroqProvider implements Provider {
  name = 'groq';
  private apiKey: string = '';
  private model: string = 'llama-3.1-70b-versatile';
  private baseUrl: string = 'api.groq.com';

  async initialize(config: any): Promise<void> {
    this.apiKey = config.apiKey;
    this.model = config.model || 'llama-3.1-70b-versatile';
    console.log(`[GroqProvider] Inicializado con modelo: ${this.model}`);
  }

  async chat(messages: any[], options?: any): Promise<LLMResponse> {
    const startTime = Date.now();
    const body = JSON.stringify({
      model: this.model,
      messages,
      temperature: options?.temperature || 0.5,
      max_tokens: options?.maxTokens || 2048
    });

    return new Promise((resolve) => {
      const reqOptions = {
        hostname: this.baseUrl,
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 20000
      };

      const req = https.request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          const latencyMs = Date.now() - startTime;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) return resolve({ success: false, content: '', latencyMs, error: parsed.error.message });

            const content = parsed.choices?.[0]?.message?.content || '';
            const usage = parsed.usage ? {
              promptTokens: parsed.usage.prompt_tokens,
              completionTokens: parsed.usage.completion_tokens,
              totalTokens: parsed.usage.total_tokens
            } : undefined;

            resolve({ success: true, content, latencyMs, usage });
          } catch (e: any) {
            resolve({ success: false, content: '', error: `Groq Parse Error: ${e.message}`, latencyMs });
          }
        });
      });

      req.on('error', e => resolve({ success: false, content: '', error: e.message, latencyMs: Date.now() - startTime }));
      req.write(body);
      req.end();
    });
  }
}

export default new GroqProvider();
