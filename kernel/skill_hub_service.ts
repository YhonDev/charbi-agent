// kernel/skill_hub_service.ts
// Orquestador de proveedores de skills.
// Decide qué provider usar según el prefijo: "openclaw:weather", "local:myskill"

import path from 'path';
import { SkillProvider, SkillSearchResult, SkillManifest } from './skill_provider';
import { LocalProvider } from './providers/local_provider';
import { OpenClawProvider } from './providers/openclaw_provider';
import { CHARBI_HOME } from './config_service';

const SKILLS_DIR = path.join(CHARBI_HOME, 'skills');

class SkillHubService {
  private providers: Map<string, SkillProvider> = new Map();

  constructor() {
    // Registrar proveedores por defecto
    this.registerProvider(new LocalProvider());
    this.registerProvider(new OpenClawProvider());
  }

  /** Registra un nuevo proveedor de skills */
  registerProvider(provider: SkillProvider): void {
    this.providers.set(provider.name, provider);
    console.log('[SkillHub] Provider registered: ' + provider.name);
  }

  /** Parsea "provider:skillName" → { provider, skillName } */
  private parseSkillRef(ref: string): { providerName: string; skillName: string } {
    if (ref.includes(':')) {
      const [providerName, skillName] = ref.split(':', 2);
      return { providerName, skillName };
    }
    return { providerName: 'openclaw', skillName: ref };
  }

  /** Busca skills en todos los providers */
  async search(query: string): Promise<SkillSearchResult[]> {
    const results: SkillSearchResult[] = [];
    for (const [, provider] of this.providers) {
      try {
        const skills = await provider.searchSkills(query);
        results.push(...skills);
      } catch (e) {
        console.warn('[SkillHub] Search failed for provider ' + provider.name);
      }
    }
    return results;
  }

  /** Instala una skill: "openclaw:weather" o "weather" (default: openclaw) */
  async install(ref: string): Promise<SkillManifest> {
    const { providerName, skillName } = this.parseSkillRef(ref);
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error('Unknown provider: ' + providerName);

    console.log('[SkillHub] Installing ' + skillName + ' from ' + providerName);
    return provider.installSkill(skillName, SKILLS_DIR);
  }

  /** Actualiza una skill */
  async update(ref: string): Promise<SkillManifest> {
    const { providerName, skillName } = this.parseSkillRef(ref);
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error('Unknown provider: ' + providerName);

    return provider.updateSkill(skillName, SKILLS_DIR);
  }

  /** Elimina una skill */
  async remove(ref: string): Promise<boolean> {
    const { providerName, skillName } = this.parseSkillRef(ref);
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error('Unknown provider: ' + providerName);

    return provider.removeSkill(skillName, SKILLS_DIR);
  }

  /** Lista todos los proveedores registrados */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export default SkillHubService;
export { SkillHubService };
