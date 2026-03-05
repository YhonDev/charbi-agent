// providers/openai.ts
// Proveedor de LLM para OpenAI (GPT-4, GPT-3.5) compatible con la interfaz de Charbi.

import { Provider, LLMResponse } from '../kernel/providers/provider_interface';
import https from 'https';

class OpenAIProvider implements Provider {
  name = 'openai';
  private apiKey: string = '';
  private model: string = 'gpt-4o';
  private baseUrl: string = 'api.openai.com';

  async initialize(config: any): Promise<void> {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o';
    const url = new URL(config.endpoint || 'https://api.openai.com/v1');
    this.baseUrl = url.hostname;
    console.log(`[OpenAIProvider] Inicializado con modelo: ${this.model}`);
  }

  async chat(messages: any[], options?: any): Promise<LLMResponse> {
    const startTime = Date.now();
    const body = JSON.stringify({
      model: this.model,
      messages,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 2048
    });

    return new Promise((resolve) => {
      const reqOptions = {
        hostname: this.baseUrl,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 30000
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
            resolve({ success: false, content: '', error: `OpenAI Parse Error: ${e.message}`, latencyMs });
          }
        });
      });

      req.on('error', e => resolve({ success: false, content: '', error: e.message, latencyMs: Date.now() - startTime }));
      req.write(body);
      req.end();
    });
  }
}

export default new OpenAIProvider();
