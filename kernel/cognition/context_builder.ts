// kernel/cognition/context_builder.ts
// Pieza crítica de la capa cognitiva: Orquestador de contexto para el LLM.
// Reúne: Soul, Memoria Híbrida, Herramientas y Estado del Mundo.

import { cognitionLoader } from '../cognition_loader';
import { memoryClient } from './memory_client';

export interface ContextOptions {
  agentName: string;
  userInput: string;
  toolsSchema: string;
  history?: any[];
}

export class ContextBuilder {
  /**
   * Construye el prompt completo inyectando memorias semánticas y estructurales.
   */
  async build(options: ContextOptions): Promise<string> {
    const { agentName, userInput, toolsSchema, history } = options;

    // 1. Cargar la Identidad Base (Soul, Mission, etc.)
    const baseSystem = cognitionLoader.buildSystemPrompt(agentName, toolsSchema);

    // 2. Búsqueda Híbrida en Memoria (Lite)
    let memoryPart = '';
    try {
      // Placeholder vectorial (mock para la búsqueda semántica rápida)
      const mockVector = new Array(384).fill(0).map(() => Math.random());

      const memoryResults = await memoryClient.call('memory.search', {
        vector: mockVector,
        text: userInput,
        k: 3
      });

      if (memoryResults) {
        memoryPart = this.formatMemory(memoryResults);
      }
    } catch (e) {
      console.error('[ContextBuilder] Error fetching hybrid memory:', e);
    }

    // 3. Instrucciones del Ciclo Cognitivo Avanzado
    const loopInstructions = `
### Mandatory Operational Protocol (THINK-PLAN-ACT):
Eres un agente autónomo de Charbi. Tienes prohibido decir que no puedes realizar una tarea o que no tienes acceso a información en tiempo real si existe una herramienta para ello.

1. **THINK**: Analiza qué herramientas necesitas.
2. **PLAN**: Divide la tarea en pasos lógicos.
3. **ACT**: Para obtener datos actuales o interactuar con el mundo, **DEBES** usar una herramienta. 
   - No digas "Como modelo de lenguaje no tengo acceso...". 
   - Di: {"thought": "Voy a buscar...", "tool": "system.search", "params": {"query": "..."}}

Si decides actuar, responde **UNICAMENTE** con este JSON (sin texto fuera):
{
  "thought": "Tu razonamiento",
  "plan": ["paso 1", "paso 2"],
  "tool": "skill.nombre_herramienta",
  "params": { ... }
}

Si ya has terminado la tarea o es una charla simple, responde normalmente en lenguaje natural.
`;

    return `
${baseSystem}

${memoryPart}

${loopInstructions}

### USER CONTEXT:
Input: ${userInput}
`.trim();
  }

  private formatMemory(results: any): string {
    let output = '\n### CONTEXTO DESDE MEMORIA HÍBRIDA:\n';

    // Formatear resultados semánticos
    if (results.semantic && results.semantic.length > 0) {
      output += '\n* Recuerdos Semánticos (Similitud):\n';
      results.semantic.forEach((r: any) => {
        output += `- ${r.text} (Relevancia: ${Math.round(r.score * 100)}%)\n`;
      });
    }

    // Formatear resultados estructurales (Grafo)
    if (results.structural && results.structural.length > 0) {
      output += '\n* Relaciones Estructurales (Grafo):\n';
      results.structural.forEach((r: any) => {
        output += `- [${r.subject}] --${r.relation}--> [${r.object}]\n`;
      });
    }

    return output === '\n### CONTEXTO DESDE MEMORIA HÍBRIDA:\n' ? '' : output;
  }
}

export const contextBuilder = new ContextBuilder();
export default contextBuilder;
