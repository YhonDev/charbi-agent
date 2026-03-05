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
      style: this.readFile(cognitionDir, 'STYLE.md')
    };
  }

  private readFile(dir: string, filename: string): string {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    }
    // Fallback a archivos globales si no existen en el agente
    const globalPath = path.join(path.dirname(dir), '..', 'cognition', filename);
    if (fs.existsSync(globalPath)) {
      return fs.readFileSync(globalPath, 'utf8');
    }
    return '';
  }

  /** Construye el System Prompt completo para el LLM */
  buildSystemPrompt(agentName: string, toolsSchema: string): string {
    const cognition = this.loadAgentCognition(agentName);

    return `
# SYSTEM COGNITION: ${agentName.toUpperCase()}
${cognition.soul}

## MISSION
${cognition.mission}

## OPERATIONAL RULES
${cognition.rules}

## RESPONSE STYLE
${cognition.style}

## AVAILABLE TOOLS (JSON Schema)
${toolsSchema}

## FINAL INSTRUCTIONS
- Responde siempre siguiendo tu IDENTIDAD (SOUL) y las REGLAS OPERATIVAS.
- Si necesitas una acción, usa el formato JSON de herramientas: {"tool": "...", "params": {...}}
- Responde en el idioma del usuario (preferiblemente Español).
`.trim();
  }
}

export const cognitionLoader = new CognitionLoader();
export default cognitionLoader;
