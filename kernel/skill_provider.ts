// kernel/skill_provider.ts
// Interfaz universal de proveedor de skills.
// Permite conectar múltiples fuentes: local, OpenClaw Hub, GitHub, etc.

export interface SkillManifest {
  name: string;
  description: string;
  version: string;
  entry: string;
  type: 'skill' | 'tool' | 'agent';
  permissions?: string[];
  provider?: string;
}

export interface SkillSearchResult {
  name: string;
  description: string;
  version: string;
  provider: string;
  installed: boolean;
}

export interface SkillProvider {
  readonly name: string;

  /** Lista las skills disponibles en este proveedor */
  listSkills(): Promise<SkillSearchResult[]>;

  /** Busca skills por query */
  searchSkills(query: string): Promise<SkillSearchResult[]>;

  /** Instala una skill por nombre */
  installSkill(skillName: string, targetDir: string): Promise<SkillManifest>;

  /** Actualiza una skill instalada */
  updateSkill(skillName: string, targetDir: string): Promise<SkillManifest>;

  /** Elimina una skill */
  removeSkill(skillName: string, targetDir: string): Promise<boolean>;
}
