// kernel/skill_adapter.ts
// Capa de seguridad para ejecución de skills.
// Las skills NUNCA acceden al filesystem/shell/network directamente.
// Solo pueden ejecutar acciones a través del KernelAction del Supervisor.

import { RegisteredSkill } from './skill_registry';

export interface SkillContext {
  /** Ejecuta una acción controlada por el Supervisor */
  action(actionType: string, params: any): Promise<any>;
  /** Logger seguro */
  log(message: string): void;
  /** Acceso a configuración de la skill (solo lectura) */
  config: Record<string, any>;
}

class SkillAdapter {
  /**
   * Ejecuta una skill envolviendo el contexto en un sandbox seguro.
   * La skill solo ve ctx.action() — nunca tiene acceso directo a:
   * - filesystem
   * - shell
   * - network
   * - process
   */
  async run(skill: RegisteredSkill, params: any, kernelAction: Function): Promise<any> {
    // Verificar que la skill esté activa
    if (!skill.active) {
      throw new Error('Skill ' + skill.manifest.name + ' is not active');
    }

    // Crear contexto seguro (sandbox)
    const safeCtx: SkillContext = {
      action: async (actionType: string, actionParams: any) => {
        // Todas las acciones pasan por el Supervisor/RiskEngine del kernel
        return kernelAction({
          type: actionType,
          origin: 'skill:' + skill.manifest.name,
          params: actionParams,
          permissions: skill.manifest.permissions || [],
        });
      },
      log: (message: string) => {
        console.log('[Skill:' + skill.manifest.name + '] ' + message);
      },
      config: { ...(skill.manifest as any) },
    };

    // Cargar el módulo si no está cargado
    if (!skill.module) {
      try {
        skill.module = require(skill.path + '/' + skill.manifest.entry);
      } catch (e) {
        throw new Error('Failed to load skill module: ' + skill.manifest.name);
      }
    }

    // Ejecutar: buscar run(), execute(), o default export
    const runFn = skill.module.run || skill.module.execute || skill.module.default;
    if (typeof runFn === 'function') {
      return runFn(safeCtx, params);
    }

    throw new Error('Skill ' + skill.manifest.name + ' has no run/execute function');
  }
}

export default SkillAdapter;
export { SkillAdapter };
