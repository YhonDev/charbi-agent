// kernel/config_service.ts
// Singleton que carga charbi-agent.yaml, expone getters tipados y soporta hot-reload.

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { EventEmitter } from 'events';

export const CHARBI_HOME = process.env.CHARBI_HOME || path.join(require('os').homedir(), '.charbi-agent');
export const CONFIG_PATH = path.join(CHARBI_HOME, 'config', 'charbi-agent.yaml');

export interface CharbiConfig {
  system: { name: string; version: number; mode: string };
  provider: { name: string; enabled: boolean; model: string; auth_type: string; endpoint: string; api_key_env?: string };
  models: { router: string; fallback: string };
  gateway?: { port: number; host: string; auth_enabled: boolean; auth_token?: string };
  channels: { [name: string]: { enabled: boolean; bot_token?: string; token_env?: string;[key: string]: any } };
  skills: { [key: string]: any };
  supervisor: { enabled: boolean; policy_file: string; max_cpu_time: number; max_tool_calls?: number; emergency_kill: boolean };
  runtime: { session_path: string; isolate_workspace: boolean; autonomy?: any };
  memory?: { kernel_db: string; sessions_db: string };
}

class ConfigService extends EventEmitter {
  private static instance: ConfigService;
  private config!: CharbiConfig;
  private watcher: fs.FSWatcher | null = null;

  private constructor() {
    super();
    this.load();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  load(): CharbiConfig {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      this.config = yaml.load(raw) as CharbiConfig;
      console.log('[ConfigService] Config loaded from', CONFIG_PATH);
      return this.config;
    } catch (e) {
      console.error('[ConfigService] Failed to load config:', e);
      throw e;
    }
  }

  getAll(): CharbiConfig { return { ...this.config }; }
  getSystem() { return this.config.system; }
  getProvider() { return this.config.provider; }
  getModels() { return this.config.models; }
  getGateway() { return this.config.gateway; }
  getChannels() { return this.config.channels; }
  getSkills() { return this.config.skills; }
  getSupervisor() { return this.config.supervisor; }
  getRuntime() { return this.config.runtime; }
  getMemory() { return this.config.memory; }

  get(dotPath: string): any {
    const keys = dotPath.split('.');
    let ref: any = this.config;
    for (const k of keys) { ref = ref?.[k]; }
    return ref;
  }

  enableHotReload(): void {
    if (this.watcher) return;
    this.watcher = fs.watch(CONFIG_PATH, (eventType) => {
      if (eventType === 'change') {
        console.log('[ConfigService] Config file changed, reloading...');
        try {
          const oldConfig = { ...this.config };
          this.load();
          this.emit('config:reloaded', this.config, oldConfig);
        } catch (e) {
          console.error('[ConfigService] Hot-reload failed:', e);
        }
      }
    });
    console.log('[ConfigService] Hot-reload enabled');
  }

  disableHotReload(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

export default ConfigService;
export { ConfigService };
