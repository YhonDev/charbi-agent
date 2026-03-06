// kernel/services/maintenance_service.ts
import fs from 'fs';
import path from 'path';
import { CHARBI_HOME } from '../config_service';

export class MaintenanceService {
  private static instance: MaintenanceService;
  private interval: NodeJS.Timeout | null = null;
  private readonly LOGS_DIR = path.join(CHARBI_HOME, 'logs');
  private readonly BACKUPS_DIR = path.join(CHARBI_HOME, 'config', 'backups');

  private constructor() { }

  static getInstance(): MaintenanceService {
    if (!MaintenanceService.instance) {
      MaintenanceService.instance = new MaintenanceService();
    }
    return MaintenanceService.instance;
  }

  async start(): Promise<void> {
    console.log('[MaintenanceService] Starting lifecycle maintenance...');

    // Ejecutar limpieza inicial
    await this.performCleanup();

    // Programar limpieza cada 6 horas
    this.interval = setInterval(() => {
      this.performCleanup();
    }, 6 * 60 * 60 * 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async performCleanup(): Promise<void> {
    console.log('[MaintenanceService] Performing scheduled cleanup...');
    try {
      // 1. Rotar Logs (máximo 10)
      await this.rotateFiles(this.LOGS_DIR, '.log', 10);

      // 2. Rotar Backups de Config (máximo 5)
      await this.rotateFiles(this.BACKUPS_DIR, '.bak', 5);

      console.log('[MaintenanceService] Cleanup completed.');
    } catch (error) {
      console.error('[MaintenanceService] Cleanup failed:', error);
    }
  }

  private async rotateFiles(directory: string, extension: string, maxFiles: number): Promise<void> {
    if (!fs.existsSync(directory)) return;

    const files = fs.readdirSync(directory)
      .filter(f => f.endsWith(extension))
      .map(f => {
        const fullPath = path.join(directory, f);
        return {
          name: f,
          path: fullPath,
          time: fs.statSync(fullPath).mtime.getTime()
        };
      })
      .sort((a, b) => b.time - a.time); // Más recientes primero

    if (files.length > maxFiles) {
      const toDelete = files.slice(maxFiles);
      console.log(`[MaintenanceService] Rotating ${extension} files in ${path.basename(directory)}. Removing ${toDelete.length} old files.`);

      for (const file of toDelete) {
        try {
          fs.unlinkSync(file.path);
          console.log(`[MaintenanceService] Deleted old file: ${file.name}`);
        } catch (e) {
          console.warn(`[MaintenanceService] Could not delete ${file.name}:`, e);
        }
      }
    }
  }
}

export const maintenanceService = MaintenanceService.getInstance();
