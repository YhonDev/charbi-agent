// kernel/tool_registry.ts
// Registro dinámico de herramientas (tools) para Charbi.
// Escanea skills/*/tools/*.ts para cargar schemas y handlers.

import fs from 'fs';
import path from 'path';
import { CharbiTool, ToolSchema } from './tool_interface';

class ToolRegistry {
  private tools: Map<string, CharbiTool> = new Map();

  /** Escanea recursivamente los directorios de skills buscando herramientas */
  async loadTools(): Promise<void> {
    const charbiHome = process.env.CHARBI_HOME || path.join(require('os').homedir(), '.charbi-agent');
    const skillsBaseDirs = [
      path.join(charbiHome, 'skills'),
      path.join(charbiHome, 'agents')
    ];

    console.log('[ToolRegistry] Escaneando herramientas...');

    for (const baseDir of skillsBaseDirs) {
      if (!fs.existsSync(baseDir)) continue;

      const skills = fs.readdirSync(baseDir);
      for (const skillName of skills) {
        const toolsDir = path.join(baseDir, skillName, 'tools');
        if (fs.existsSync(toolsDir)) {
          await this.loadToolsFromDir(toolsDir, skillName);
        }
      }
    }
  }

  private async loadToolsFromDir(dir: string, skillName: string): Promise<void> {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

      const modulePath = path.resolve(dir, file);
      try {
        const mod = await import(modulePath);

        let toolsToRegister: CharbiTool[] = [];

        // 1. Manejar export default (objeto único o array)
        if (mod.default) {
          if (Array.isArray(mod.default)) {
            toolsToRegister.push(...mod.default);
          } else {
            toolsToRegister.push(mod.default);
          }
        }

        // 2. Manejar otras exportaciones con nombre (opcional)
        for (const key in mod) {
          if (key === 'default') continue;
          const item = mod[key];
          if (item && item.schema && item.handler) {
            toolsToRegister.push(item);
          }
        }

        for (const tool of toolsToRegister) {
          if (tool && tool.schema && tool.schema.name) {
            const fullName = `${skillName}.${tool.schema.name}`;
            this.tools.set(fullName, tool);
            console.log(`[ToolRegistry] ✓ Herramienta cargada: ${fullName}`);
          }
        }
      } catch (e: any) {
        console.error(`[ToolRegistry] Error cargando ${file} en ${skillName}:`, e.message);
      }
    }
  }

  /** Obtiene una herramienta por su nombre completo (skill.name) */
  getTool(fullName: string): CharbiTool | undefined {
    return this.tools.get(fullName);
  }

  /** Lista todos los schemas de las herramientas con sus nombres completos */
  getAllSchemas(): ToolSchema[] {
    return Array.from(this.tools.entries()).map(([fullName, tool]) => ({
      ...tool.schema,
      name: fullName
    }));
  }

  /** Lista los nombres de las herramientas disponibles */
  listNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

export const toolRegistry = new ToolRegistry();
export default toolRegistry;
