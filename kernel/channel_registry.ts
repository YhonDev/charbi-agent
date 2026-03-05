// kernel/channel_registry.ts
// Carga canales desde la config y los instancia dinámicamente.
// Cada canal es un adapter que emite eventos al EventBus.

import path from 'path';
import { EventEmitter } from 'events';
import { ConfigService, CHARBI_HOME } from './config_service';

// ---------- Interface ----------

export interface ChannelAdapter {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: string, target?: string): Promise<void>;
}

// ---------- Registry ----------

class ChannelRegistry extends EventEmitter {
  private channels: Map<string, ChannelAdapter> = new Map();
  private configService: ConfigService;

  constructor() {
    super();
    this.configService = ConfigService.getInstance();
  }

  /** Carga e inicializa todos los canales habilitados desde la config */
  async init(): Promise<void> {
    const channelsConfig = this.configService.getChannels();

    for (const [name, cfg] of Object.entries(channelsConfig)) {
      if (!cfg.enabled) continue;

      try {
        const adapter = await this.loadAdapter(name, cfg);
        if (adapter) {
          this.channels.set(name, adapter);
          console.log(`[ChannelRegistry] Loaded: ${name}`);
        }
      } catch (e) {
        console.error(`[ChannelRegistry] Failed to load '${name}':`, e);
      }
    }
  }

  /** Carga un adapter específico por nombre */
  private async loadAdapter(name: string, config: any): Promise<ChannelAdapter | null> {
    const adapterPath = path.join(CHARBI_HOME, 'channels', name, 'adapter.ts');

    try {
      const module = require(adapterPath);
      const AdapterClass = module.default || module[Object.keys(module)[0]];
      return new AdapterClass(config, this);
    } catch (e) {
      // Si no existe un adapter custom, usar stub
      console.warn(`[ChannelRegistry] No adapter found at ${adapterPath}, using stub`);
      return {
        name,
        start: async () => { console.log('[Channel:' + name + '] Started (stub)'); },
        stop: async () => { console.log('[Channel:' + name + '] Stopped (stub)'); },
        send: async (msg: string) => { console.log('[Channel:' + name + '] -> ' + msg); },
      };
    }
  }

  /** Inicia todos los canales cargados */
  async startAll(): Promise<void> {
    for (const [name, channel] of this.channels) {
      try {
        await channel.start();
        console.log(`[ChannelRegistry] Started: ${name}`);
        this.emit('channel:started', name);
      } catch (e) {
        console.error(`[ChannelRegistry] Failed to start '${name}':`, e);
      }
    }
  }

  /** Detiene todos los canales */
  async stopAll(): Promise<void> {
    for (const [name, channel] of this.channels) {
      try {
        await channel.stop();
        this.emit('channel:stopped', name);
      } catch (e) {
        console.error(`[ChannelRegistry] Failed to stop '${name}':`, e);
      }
    }
  }

  /** Obtiene un canal por nombre */
  getChannel(name: string): ChannelAdapter | undefined {
    return this.channels.get(name);
  }

  /** Lista canales activos */
  listActive(): string[] {
    return Array.from(this.channels.keys());
  }
}

export default ChannelRegistry;
export { ChannelRegistry };
