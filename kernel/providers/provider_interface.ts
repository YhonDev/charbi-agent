// kernel/providers/provider_interface.ts
// Interfaz base que todos los proveedores de LLM deben implementar en Charbi.

export interface LLMResponse {
  success: boolean;
  content: string;
  latencyMs: number;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface Provider {
  name: string;

  /** Inicializa el proveedor con su configuración específica */
  initialize(config: any): Promise<void>;

  /** Ejecuta una consulta de chat al modelo */
  chat(messages: any[], options?: any): Promise<LLMResponse>;

  /** Genera embeddings para un texto (opcional) */
  embeddings?(input: string): Promise<number[]>;

  /** Libera recursos si es necesario */
  shutdown?(): Promise<void>;
}

export default Provider;
