// charbi/kernel/skill_loader.ts
import fs from 'fs';
import path from 'path';
import { runInSession } from './process_manager';

export class OpenClawAdapter {
  private skillPath: string;
  private manifest: any;

  constructor(skillPath: string) {
    this.skillPath = skillPath;
    const manifestPath = path.join(skillPath, 'package.json'); // OpenClaw skills often use package.json
    if (fs.existsSync(manifestPath)) {
      this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } else {
      this.manifest = { name: path.basename(skillPath), version: '1.0.0' };
    }
  }

  /**
   * mapPermissions
   * Traduce las necesidades de la skill a un perfil de permisos del Supervisor.
   */
  mapPermissions(): Record<string, boolean> {
    const profile: Record<string, boolean> = {};
    const permissions = this.manifest.openclaw?.permissions || ['filesystem.read'];

    for (const p of permissions) {
      profile[p] = true;
    }
    return profile;
  }

  /**
   * execute
   * Ejecuta la skill en el contexto de una sesión.
   */
  async execute(session: any, params: any) {
    console.log(`[SkillLoader] Loading OpenClaw skill: ${this.manifest.name}`);
    const entry = this.manifest.main || 'index.js';
    const cmd = `node ${path.join(this.skillPath, entry)} ${JSON.stringify(params)}`;

    return await runInSession(session, cmd);
  }
}
