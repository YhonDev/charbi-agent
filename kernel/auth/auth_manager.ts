// kernel/auth/auth_manager.ts
// Manager centralizado de autenticación para Charbi.
// Orquesta los diferentes proveedores y el almacén de tokens.

import { TokenStore } from './token_store';
import { QwenDeviceAuth } from './providers/qwen_device_auth';

export type Provider = 'qwen' | 'openai' | 'ollama' | 'groq' | string;

export class AuthManager {
  /** Inicia el login interactivo para un proveedor */
  static async login(provider: Provider) {
    console.log(`[AuthManager] Iniciando login para: ${provider}`);

    switch (provider.toLowerCase()) {
      case 'qwen':
        return await QwenDeviceAuth.login();

      case 'openai':
      case 'groq':
        console.log(`\n[AuthManager] Para ${provider}, usa 'charbi auth ${provider} --key <API_KEY>'`);
        return null;

      default:
        console.warn(`[AuthManager] Proveedor no soportado aún: ${provider}`);
        return null;
    }
  }

  /** Obtiene un token válido para un proveedor */
  static getToken(provider: Provider): string | null {
    const data = TokenStore.load(provider);
    if (!data) {
      console.warn(`[AuthManager] No hay credenciales para ${provider}. Ejecuta 'charbi auth ${provider}'`);
      return null;
    }

    // Si es un token de OAuth, devolver el access_token
    if (data.access_token) return data.access_token;

    // Si se guardó una API key directamente
    if (data.apiKey) return data.apiKey;

    return null;
  }

  /** Guarda una API key directamente (para proveedores sin OAuth) */
  static saveApiKey(provider: Provider, apiKey: string) {
    TokenStore.save(provider, { apiKey, timestamp: Date.now() });
    console.log(`[AuthManager] API Key guardada para ${provider}`);
  }

  /** Lista el estado de autenticación de todos los proveedores configurados */
  static listAuthStatus() {
    const providers = ['qwen', 'openai', 'groq', 'ollama'];
    const authenticated = TokenStore.listProviders();

    return providers.map(id => ({
      provider: id,
      authenticated: authenticated.includes(id)
    }));
  }
}

export default AuthManager;
