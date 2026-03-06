// kernel/services/status_service.ts
// Servicio recolector de estado del runtime de Charbi.

import ConfigService from '../config_service';
import { toolRegistry } from '../tool_registry';
// Acceso vía global para evitar dependencias circulares con bootstrap
import { memoryManager } from '../cognition/memory_manager';
import { AuthManager } from '../auth/auth_manager';

import { memoryClient } from '../cognition/memory_client';
import fs from 'fs';
import path from 'path';

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
      },
      security: {
        engine: 'ACTIVE',
        rules_loaded: 15, // Placeholder o contar si hay un RuleEngine
        permissions: ['filesystem.read', 'shell.execute', 'network.access'] // Default profiles
      },
      recent_logs: this.getRecentLogs()
    };
  }

  private static getRecentLogs(): string[] {
    const charbiHome = process.env.CHARBI_HOME || path.join(require('os').homedir(), '.charbi-agent');
    const logPath = path.join(charbiHome, 'run', 'kernel.log');

    try {
      if (!fs.existsSync(logPath)) return ['Log file not found'];

      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.trim().split('\n');
      return lines.slice(-10); // Últimas 10 líneas
    } catch (e) {
      return [`Error reading logs: ${e.message}`];
    }
  }
}

export default StatusService;
