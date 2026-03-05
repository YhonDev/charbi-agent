// providers/qwen.ts
// Proveedor de Qwen (Alibaba Cloud) para Charbi.
// Utiliza OAuth Device Flow para obtener tokens.

import { Provider, LLMResponse } from '../kernel/providers/provider_interface';
import { TokenStore } from '../kernel/auth/token_store';

export class QwenProvider implements Provider {
  name = 'qwen';
  private config: any = {};

  async initialize(config: any): Promise<void> {
    this.config = config;
  }

  async chat(messages: any[], options?: any): Promise<LLMResponse> {
    const startTime = Date.now();
    const tokenData = TokenStore.load('qwen');

    if (!tokenData || !tokenData.access_token) {
      throw new Error('Qwen no autenticado. Ejecuta: charbi auth qwen');
    }

    try {
      const res = await fetch('https://chat.qwen.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        },
        body: JSON.stringify({
          model: this.config.model || 'qwen-plus',
          messages: messages,
          stream: false
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Qwen API Error (${res.status}): ${errorText}`);
      }

      const data: any = await res.json();

      return {
        success: true,
        content: data.choices[0]?.message?.content || '',
        usage: data.usage,
        latencyMs: Date.now() - startTime
      };

    } catch (e: any) {
      return {
        success: false,
        content: '',
        error: e.message,
        latencyMs: Date.now() - startTime
      };
    }
  }

  async embed(text: string): Promise<number[]> {
    throw new Error('Embeddings not implemented for Qwen yet.');
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}

const provider = new QwenProvider();
export default provider;
