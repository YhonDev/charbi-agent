// kernel/providers/openclaw_provider.ts
// Proveedor de skills del OpenClaw Hub.
// Busca, descarga e instala skills desde el marketplace de OpenClaw.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { SkillProvider, SkillManifest, SkillSearchResult } from '../skill_provider';

const OPENCLAW_HUB_URL = process.env.OPENCLAW_HUB_URL || 'https://hub.openclaw.ai';

class OpenClawProvider implements SkillProvider {
  readonly name = 'openclaw';

  async listSkills(): Promise<SkillSearchResult[]> {
    try {
      const res = await fetch(OPENCLAW_HUB_URL + '/api/skills');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json() as any[];
      return data.map((s: any) => ({
        name: s.name,
        description: s.description || '',
        version: s.version || '1.0.0',
        provider: 'openclaw',
        installed: false,
      }));
    } catch (e) {
      console.warn('[OpenClawProvider] Hub unreachable, returning empty list');
      return [];
    }
  }

  async searchSkills(query: string): Promise<SkillSearchResult[]> {
    const all = await this.listSkills();
    const q = query.toLowerCase();
    return all.filter(s => s.name.includes(q) || s.description.toLowerCase().includes(q));
  }

  async installSkill(skillName: string, targetDir: string): Promise<SkillManifest> {
    const skillDir = path.join(targetDir, 'openclaw', skillName);

    // Intentar clonar desde GitHub (OpenClaw skills están en repos)
    const repoUrl = OPENCLAW_HUB_URL + '/skills/' + skillName + '.git';
    console.log('[OpenClawProvider] Installing ' + skillName + ' from ' + repoUrl);

    if (!fs.existsSync(path.join(targetDir, 'openclaw'))) {
      fs.mkdirSync(path.join(targetDir, 'openclaw'), { recursive: true });
    }

    try {
      execSync('git clone --depth 1 ' + repoUrl + ' ' + skillDir, { stdio: 'pipe' });
    } catch (e) {
      // Fallback: crear directorio con manifest básico
      console.warn('[OpenClawProvider] Git clone failed, creating stub');
      fs.mkdirSync(skillDir, { recursive: true });
      const manifest: SkillManifest = {
        name: skillName,
        description: 'OpenClaw skill: ' + skillName,
        version: '1.0.0',
        entry: 'index.ts',
        type: 'skill',
        permissions: [],
        provider: 'openclaw',
      };
      fs.writeFileSync(path.join(skillDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      fs.writeFileSync(path.join(skillDir, 'index.ts'), '// Stub for ' + skillName + '\nexport default {};\n');
      return manifest;
    }

    // Leer manifest del skill clonado
    const manifestPath = path.join(skillDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }

    return {
      name: skillName,
      description: 'OpenClaw skill',
      version: '1.0.0',
      entry: 'index.ts',
      type: 'skill',
      provider: 'openclaw',
    };
  }

  async updateSkill(skillName: string, targetDir: string): Promise<SkillManifest> {
    const skillDir = path.join(targetDir, 'openclaw', skillName);
    if (fs.existsSync(skillDir)) {
      try {
        execSync('git -C ' + skillDir + ' pull', { stdio: 'pipe' });
        console.log('[OpenClawProvider] Updated: ' + skillName);
      } catch (e) {
        console.warn('[OpenClawProvider] Update failed for ' + skillName);
      }
    }
    return this.installSkill(skillName, targetDir);
  }

  async removeSkill(skillName: string, targetDir: string): Promise<boolean> {
    const skillDir = path.join(targetDir, 'openclaw', skillName);
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true });
      console.log('[OpenClawProvider] Removed: ' + skillName);
      return true;
    }
    return false;
  }
}

export default OpenClawProvider;
export { OpenClawProvider };
