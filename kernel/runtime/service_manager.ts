// kernel/runtime/service_manager.ts
// Gestor central de servicios del kernel Charbi.
// Permite iniciar, detener y monitorear componentes de forma individual.

export interface Service {
  name: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  running: boolean;
  type?: 'core' | 'channel' | 'plugin';
}

export class ServiceManager {
  private static services = new Map<string, Service>();

  static register(service: Service) {
    this.services.set(service.name, service);
    console.log(`[ServiceManager] Registered: ${service.name}`);
  }

  static async start(name: string) {
    const s = this.services.get(name);
    if (!s) {
      console.warn(`[ServiceManager] Service not found: ${name}`);
      return;
    }
    if (s.running) return;

    try {
      console.log(`[ServiceManager] Starting ${name}...`);
      await s.start();
      s.running = true;
      console.log(`[ServiceManager] ${name} started.`);
    } catch (e) {
      console.error(`[ServiceManager] Failed to start ${name}:`, e);
      throw e;
    }
  }

  static async stop(name: string) {
    const s = this.services.get(name);
    if (!s || !s.running) return;

    try {
      console.log(`[ServiceManager] Stopping ${name}...`);
      await s.stop();
      s.running = false;
      console.log(`[ServiceManager] ${name} stopped.`);
    } catch (e) {
      console.error(`[ServiceManager] Failed to stop ${name}:`, e);
    }
  }

  static async startAll() {
    for (const name of this.services.keys()) {
      await this.start(name);
    }
  }

  static async stopAll() {
    // Detener en orden inverso por si hay dependencias implícitas
    const names = Array.from(this.services.keys()).reverse();
    for (const name of names) {
      await this.stop(name);
    }
  }

  static getStatus() {
    return Array.from(this.services.values()).map(s => ({
      name: s.name,
      running: s.running,
      type: s.type || 'core'
    }));
  }

  static isRunning(name: string): boolean {
    return this.services.get(name)?.running || false;
  }
}

export default ServiceManager;
