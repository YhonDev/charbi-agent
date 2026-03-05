// kernel/providers/local_provider.ts
// Proveedor de skills locales — escanea carpetas del filesystem.

import fs from 'fs';
import path from 'path';
import { SkillProvider, SkillManifest, SkillSearchResult } from '../skill_provider';

class LocalProvider implements SkillProvider {
  readonly name = 'local';

  async listSkills(): Promise<SkillSearchResult[]> {
    // Las skills locales se cargan directamente por el PluginLoader.
    // Este provider es más un placeholder para el SkillHubService.
    return [];
  }

  async searchSkills(query: string): Promise<SkillSearchResult[]> {
    return [];
  }

  async installSkill(skillName: string, targetDir: string): Promise<SkillManifest> {
    throw new Error('Local skills are managed via filesystem, not installed via hub');
  }

  async updateSkill(skillName: string, targetDir: string): Promise<SkillManifest> {
    throw new Error('Local skills are managed via filesystem');
  }

  async removeSkill(skillName: string, targetDir: string): Promise<boolean> {
    const skillDir = path.join(targetDir, skillName);
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true });
      console.log('[LocalProvider] Removed: ' + skillName);
      return true;
    }
    return false;
  }
}

export default LocalProvider;
export { LocalProvider };
