// providers/gemini.ts
// Proveedor de LLM en la nube mediante Google Gemini API.

import { Provider, LLMResponse } from '../kernel/providers/provider_interface';
import https from 'https';

class GeminiProvider implements Provider {
  name = 'gemini';
  private apiKey: string = '';
  private model: string = 'gemini-1.5-flash';

  async initialize(config: any): Promise<void> {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-1.5-flash';
    console.log(`[GeminiProvider] Inicializado con modelo: ${this.model}`);
  }

  async chat(messages: any[], options?: any): Promise<LLMResponse> {
    const startTime = Date.now();

    // El formato de Gemini es distinto al de OpenAI, pero lo adaptamos aquí si es necesario
    // Por simplicidad en este ejemplo, usaremos el formato JSON que Gemini espera:
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 2048,
        temperature: options?.temperature || 0.2
      }
    });

    return new Promise((resolve) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 30000
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          const latencyMs = Date.now() - startTime;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) return resolve({ success: false, content: '', latencyMs, error: parsed.error.message });

            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            resolve({ success: true, content, latencyMs });
          } catch (e: any) {
            resolve({ success: false, content: '', error: `Gemini Parse Error: ${e.message}`, latencyMs });
          }
        });
      });

      req.on('error', e => resolve({ success: false, content: '', error: e.message, latencyMs: Date.now() - startTime }));
      req.write(body);
      req.end();
    });
  }
}

export default new GeminiProvider();
