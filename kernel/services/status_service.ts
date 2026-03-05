// kernel/services/status_service.ts
// Servicio recolector de estado del runtime de Charbi.

import ConfigService from '../config_service';
import { channelRegistry } from '../bootstrap'; // Asumiendo que bootstrap exporta instancias, sino usaremos Singletons
import { toolRegistry } from '../tool_registry';
import { pluginLoader } from '../bootstrap';
import { memoryManager } from '../cognition/memory_manager';
import { AuthManager } from '../auth/auth_manager';

import { memoryClient } from '../cognition/memory_client';

export class StatusService {
  static async getFullStatus() {
    const config = ConfigService.getInstance();
    const provider = config.getProvider();

    let hybridStatus = { vectors: 0, nodes: 0, edges: 0 };
    try {
      const res = await memoryClient.call('system.status');
      hybridStatus = res;
    } catch (e) {
      // Silently fail if server not ready
    }

    return {
      system: {
        kernel: 'RUNNING',
        uptime: process.uptime(),
        version: config.getSystem().version,
        mode: config.getSystem().mode
      },
      model: {
        provider: provider.name,
        model: provider.model,
        auth: AuthManager.getToken(provider.name) ? 'CONNECTED' : 'DISCONNECTED'
      },
      channels: (global as any).channelRegistry?.listStatus() || [],
      skills: (global as any).pluginLoader?.listPlugins().map((p: any) => ({
        name: p.manifest.name,
        type: p.manifest.type,
        version: p.manifest.version
      })) || [],
      tools: toolRegistry.listNames(),
      memory: {
        ...memoryManager.status(),
        hybrid: hybridStatus
      }
    };
  }
}

export default StatusService;
