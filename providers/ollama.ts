// providers/ollama.ts
// Proveedor de LLM Local mediante Ollama API (OpenAI compatible).

import { Provider, LLMResponse } from '../kernel/providers/provider_interface';
import http from 'http';

class OllamaProvider implements Provider {
  name = 'ollama';
  private model: string = 'qwen2.5-coder';
  private host: string = 'localhost';
  private port: number = 11434;

  async initialize(config: any): Promise<void> {
    this.model = config.model || 'qwen2.5-coder';
    const url = new URL(config.baseUrl || 'http://localhost:11434/v1');
    this.host = url.hostname;
    this.port = parseInt(url.port) || 11434;
    console.log(`[OllamaProvider] Inicializado con modelo: ${this.model}`);
  }

  async chat(messages: any[], options?: any): Promise<LLMResponse> {
    const startTime = Date.now();
    const body = JSON.stringify({
      model: this.model,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature || 0.3,
        num_predict: options?.maxTokens || 2048,
      }
    });

    return new Promise((resolve) => {
      const reqOptions = {
        hostname: this.host,
        port: this.port,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 60000 // Aumentado a 60s
      };

      const req = http.request(reqOptions, (res) => {
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
            resolve({ success: false, content: '', error: `Ollama Parse Error: ${e.message}`, latencyMs });
          }
        });
      });

      req.on('error', e => resolve({ success: false, content: '', error: e.message, latencyMs: Date.now() - startTime }));
      req.write(body);
      req.end();
    });
  }
}

export default new OllamaProvider();
