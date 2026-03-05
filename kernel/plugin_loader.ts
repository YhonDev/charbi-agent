// kernel/plugin_loader.ts
// Escanea directorios de agentes y skills, carga los habilitados.

import fs from 'fs';
import path from 'path';
import { ConfigService, CHARBI_HOME } from './config_service';

// ---------- Interfaces ----------

export interface PluginManifest {
  name: string;
  description: string;
  version: string;
  entry: string;
  type: 'agent' | 'skill' | 'tool';
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  path: string;
  module?: any;
}

// ---------- Loader ----------

class PluginLoader {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private configService: ConfigService;

  constructor() {
    this.configService = ConfigService.getInstance();
  }

  /** Escanea y carga todos los plugins habilitados */
  async scan(): Promise<void> {
    const skillsConfig = this.configService.getSkills();
    const agentsDir = path.join(CHARBI_HOME, skillsConfig?.auto_load_directory || 'agents');

    console.log('[PluginLoader] Scanning:', agentsDir);

    // Escanear directorio de agentes
    if (fs.existsSync(agentsDir)) {
      await this.scanDirectory(agentsDir);
    }

    // Escanear directorio de skills
    const skillsDir = path.join(CHARBI_HOME, 'skills');
    if (fs.existsSync(skillsDir)) {
      await this.scanDirectory(skillsDir);
    }

    console.log('[PluginLoader] Loaded ' + this.plugins.size + ' plugins');
  }

  /** Escanea un directorio buscando manifiestos de plugins */
  private async scanDirectory(dir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = path.join(dir, entry.name);
      const manifestPath = path.join(pluginDir, 'manifest.json');
      const packagePath = path.join(pluginDir, 'package.json');

      let manifest: PluginManifest | null = null;

      // Intentar cargar manifest.json primero, luego package.json
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch (e) {
          console.warn('[PluginLoader] Bad manifest in ' + entry.name);
        }
      } else if (fs.existsSync(packagePath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          manifest = {
            name: pkg.name || entry.name,
            description: pkg.description || '',
            version: pkg.version || '1.0.0',
            entry: pkg.main || 'index.ts',
            type: 'agent',
          };
        } catch (e) {
          console.warn('[PluginLoader] Bad package.json in ' + entry.name);
        }
      }

      if (manifest) {
        this.plugins.set(manifest.name, {
          manifest,
          path: pluginDir,
        });
        console.log('[PluginLoader] Registered: ' + manifest.name + ' (' + manifest.type + ')');
      }
    }
  }

  /** Inicializa un plugin específico */
  async loadPlugin(name: string): Promise<any> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error('Plugin not found: ' + name);
    }

    const entryPath = path.join(plugin.path, plugin.manifest.entry);
    try {
      plugin.module = require(entryPath);
      console.log('[PluginLoader] Initialized: ' + name);
      return plugin.module;
    } catch (e) {
      console.error('[PluginLoader] Failed to initialize ' + name + ':', e);
      throw e;
    }
  }

  /** Lista todos los plugins registrados */
  listPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Obtiene un plugin por nombre */
  getPlugin(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }
}

export default PluginLoader;
export { PluginLoader };
