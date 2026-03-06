// kernel/cognition_loader.ts
// Cargador dinámico de perfiles cognitivos (SOUL, MISSION, RULES, STYLE).
// Construye el System Prompt basado en la identidad del agente.

import fs from 'fs';
import path from 'path';

export interface AgentCognition {
  soul: string;
  mission: string;
  rules: string;
  style: string;
  user: string;
  identity: string;
  agents: string;
}

class CognitionLoader {
  /** Carga la cognición de un agente específico */
  loadAgentCognition(agentName: string): AgentCognition {
    const charbiHome = process.env.CHARBI_HOME || path.join(require('os').homedir(), '.charbi-agent');
    const cognitionDir = path.join(charbiHome, 'agents', agentName, 'cognition');

    return {
      soul: this.readFile(cognitionDir, 'SOUL.md'),
      mission: this.readFile(cognitionDir, 'MISSION.md'),
      rules: this.readFile(cognitionDir, 'RULES.md'),
      style: this.readFile(cognitionDir, 'STYLE.md'),
      user: this.readFile(cognitionDir, 'USER.md'),
      identity: this.readFile(cognitionDir, 'IDENTITY.md'),
      agents: this.readFile(cognitionDir, 'AGENTS.md')
    };
  }

  private readFile(dir: string, filename: string): string {
    const charbiHome = process.env.CHARBI_HOME || path.join(require('os').homedir(), '.charbi-agent');

    // Múltiples opciones para soportar diferentes convenciones:
    // 1. cognition/SOUL.md
    // 2. cognition/Soul.md (o lower)
    // 3. /agents/agentName/SOUL.md
    const optionsToTry = [
      path.join(dir, filename),
      path.join(dir, filename.toUpperCase()),
      path.join(dir, filename.toLowerCase()),
      path.join(dir, filename.charAt(0).toUpperCase() + filename.slice(1).toLowerCase()), // Capitalized

      // Fallback: un nivel arriba (ej: agents/coder/SOUL.md en lugar de agents/coder/cognition/SOUL.md)
      path.join(path.dirname(dir), filename),
      path.join(path.dirname(dir), filename.toUpperCase()),
      path.join(path.dirname(dir), filename.toLowerCase()),
      path.join(path.dirname(dir), filename.charAt(0).toUpperCase() + filename.slice(1).toLowerCase())
    ];

    for (const f of optionsToTry) {
      if (fs.existsSync(f)) {
        return fs.readFileSync(f, 'utf8');
      }
    }

    // Fallback a archivos globales si no existen en el agente (ej: ~/.charbi-agent/cognition/SOUL.md)
    const globalDir = path.join(charbiHome, 'cognition');
    const globalOptions = [
      path.join(globalDir, filename),
      path.join(globalDir, filename.toUpperCase()),
      path.join(globalDir, filename.toLowerCase()),
      path.join(globalDir, filename.charAt(0).toUpperCase() + filename.slice(1).toLowerCase())
    ];

    for (const g of globalOptions) {
      if (fs.existsSync(g)) {
        return fs.readFileSync(g, 'utf8');
      }
    }

    return '';
  }

  /** Construye el System Prompt completo para el LLM */
  buildSystemPrompt(agentName: string, toolsSchema: string): string {
    const cognition = this.loadAgentCognition(agentName);

    // Filter out empty sections to keep the prompt clean
    const sections = [
      `# SYSTEM COGNITION: ${agentName.toUpperCase()}`,
      cognition.soul ? cognition.soul.trim() : '',
      cognition.identity ? `\n## IDENTITY\n${cognition.identity.trim()}` : '',
      cognition.mission ? `\n## MISSION\n${cognition.mission.trim()}` : '',
      cognition.rules ? `\n## OPERATIONAL RULES\n${cognition.rules.trim()}` : '',
      cognition.style ? `\n## RESPONSE STYLE\n${cognition.style.trim()}` : '',
      cognition.agents ? `\n## KNOWN AGENTS\n${cognition.agents.trim()}` : '',
      cognition.user ? `\n## USER PROFILE\n${cognition.user.trim()}` : '',
      `\n## AVAILABLE TOOLS (JSON Schema)\n${toolsSchema.trim()}`,
      `\n## FINAL INSTRUCTIONS\n- Responde siempre siguiendo tu IDENTIDAD (SOUL) y las REGLAS OPERATIVAS.\n- Si necesitas una acción, usa el formato JSON de herramientas: {"tool": "...", "params": {...}}\n- Responde en el idioma del usuario (preferiblemente Español).`
    ];

    return sections.filter(s => s).join('\n').trim();
  }
}

export const cognitionLoader = new CognitionLoader();
export default cognitionLoader;
