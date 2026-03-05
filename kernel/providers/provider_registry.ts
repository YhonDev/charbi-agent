// kernel/providers/provider_registry.ts
// Registro dinámico de proveedores de LLM para Charbi.
// Busca en el directorio providers/ y carga los módulos habilitados.

import fs from 'fs';
import path from 'path';
import { Provider } from './provider_interface';

class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  /** Carga dinámicamente todos los proveedores disponibles en el sistema */
  async loadProviders(): Promise<void> {
    const providersDir = path.join(process.cwd(), 'providers');

    if (!fs.existsSync(providersDir)) {
      console.warn(`[ProviderRegistry] Directorio no encontrado: ${providersDir}`);
      return;
    }

    const files = fs.readdirSync(providersDir);
    console.log('[ProviderRegistry] Escaneando proveedores...');

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

      const modulePath = path.resolve(providersDir, file);
      try {
        const mod = await import(modulePath);
        const provider: Provider = mod.default;

        if (provider && provider.name) {
          this.providers.set(provider.name.toLowerCase(), provider);
          console.log(`[ProviderRegistry] ✓ Proveedor cargado: ${provider.name}`);
        }
      } catch (e: any) {
        console.error(`[ProviderRegistry] Error cargando ${file}:`, e.message);
      }
    }
  }

  /** Obtiene un proveedor por nombre */
  getProvider(name: string): Provider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`[ProviderRegistry] Proveedor no encontrado: ${name}`);
    }
    return provider;
  }

  /** Lista todos los proveedores registrados */
  list(): string[] {
    return Array.from(this.providers.keys());
  }

  /** Verifica si un proveedor existe */
  has(name: string): boolean {
    return this.providers.has(name.toLowerCase());
  }
}

export const providerRegistry = new ProviderRegistry();
export default providerRegistry;
