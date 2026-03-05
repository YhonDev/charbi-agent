// kernel/services/status_service.ts
// Servicio recolector de estado del runtime de Charbi.

import ConfigService from '../config_service';
import { channelRegistry } from '../bootstrap'; // Asumiendo que bootstrap exporta instancias, sino usaremos Singletons
import { toolRegistry } from '../tool_registry';
import { pluginLoader } from '../bootstrap';
import { memoryManager } from '../cognition/memory_manager';
import { AuthManager } from '../auth/auth_manager';

export class StatusService {
  static getFullStatus() {
    const config = ConfigService.getInstance();
    const provider = config.getProvider();

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
      memory: memoryManager.status()
    };
  }
}

export default StatusService;
