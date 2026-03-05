// kernel/skill_registry.ts
// Registro central de skills cargadas en el kernel.
// El kernel solo interactúa con skills a través de este registry.

import { SkillManifest } from './skill_provider';

export interface RegisteredSkill {
  manifest: SkillManifest;
  path: string;
  module?: any;
  active: boolean;
}

class SkillRegistry {
  private skills: Map<string, RegisteredSkill> = new Map();

  /** Registra una skill en el kernel */
  register(manifest: SkillManifest, skillPath: string): void {
    this.skills.set(manifest.name, {
      manifest,
      path: skillPath,
      active: true,
    });
    console.log('[SkillRegistry] Registered: ' + manifest.name + ' (' + manifest.type + ')');
  }

  /** Obtiene una skill por nombre */
  get(name: string): RegisteredSkill | undefined {
    return this.skills.get(name);
  }

  /** Lista todas las skills registradas */
  listAll(): RegisteredSkill[] {
    return Array.from(this.skills.values());
  }

  /** Lista solo las skills activas */
  listActive(): RegisteredSkill[] {
    return this.listAll().filter(s => s.active);
  }

  /** Activa/desactiva una skill */
  setActive(name: string, active: boolean): boolean {
    const skill = this.skills.get(name);
    if (skill) {
      skill.active = active;
      return true;
    }
    return false;
  }

  /** Elimina una skill del registro */
  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  /** Obtiene el conteo de skills */
  count(): number {
    return this.skills.size;
  }
}

export default SkillRegistry;
export { SkillRegistry };
