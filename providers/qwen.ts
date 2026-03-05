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

    // Prioridad: 1. API Key de la config, 2. Token de TokenStore (OAuth)
    const apiKey = this.config.apiKey || TokenStore.load('qwen')?.access_token;

    if (!apiKey) {
      throw new Error('Qwen no autenticado. Ejecuta: charbi auth qwen o configura una API Key.');
    }

    const baseUrl = (this.config.endpoint || 'https://chat.qwen.ai/api/v1').replace(/\/$/, '');
    const url = `${baseUrl}/chat/completions`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
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
