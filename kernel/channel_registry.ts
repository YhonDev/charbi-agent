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
      const mod = require(adapterPath);

      // Case 1: Default export is a class with start/stop
      if (mod.default && typeof mod.default === 'function') {
        const instance = new mod.default(config, this);
        if (typeof instance.start === 'function') return instance;
      }

      // Case 2: Module exports a class directly
      for (const key of Object.keys(mod)) {
        if (typeof mod[key] === 'function' && mod[key].prototype?.start) {
          return new mod[key](config, this);
        }
      }

      // Case 3: Function-based adapter (like Telegram's onTelegramMessage/sendTelegramResponse)
      const onMessage = mod.onTelegramMessage || mod.onMessage || mod.handleMessage;
      const sendFn = mod.sendTelegramResponse || mod.sendResponse || mod.send;
      return {
        name,
        start: async () => { console.log('[Channel:' + name + '] Started (functional adapter)'); },
        stop: async () => { console.log('[Channel:' + name + '] Stopped'); },
        send: async (msg: string, target?: string) => {
          if (sendFn) sendFn(target || '', msg);
          else console.log('[Channel:' + name + '] -> ' + msg);
        },
      };
    } catch (e) {
      // No adapter file exists, use stub
      console.warn('[ChannelRegistry] No adapter at ' + adapterPath + ', using stub');
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

  /** Lista canales con su estado operativo */
  listStatus() {
    return Array.from(this.channels.entries()).map(([name, channel]) => ({
      name,
      status: 'ACTIVE' // Por simplicidad, si está en el registry está cargado. Podríamos añadir check de health.
    }));
  }
}

export default ChannelRegistry;
export { ChannelRegistry };
