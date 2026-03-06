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
Eres un agente autónomo de Charbi. Tienes prohibido decir que no puedes realizar una tarea o que no tienes acceso a información en tiempo real. 

#### AGENT-SPECIFIC GUIDELINES:
- **Main**: Supervisor y facilitador. Usa herramientas de sistema para obtener contexto.
- **Coder**: Mentor y ejecutor. Para tareas de acción ("crea", "escribe", "ejecuta"), **USA LAS HERRAMIENTAS**.
- **Researcher**: Investigador profundo. Tu primer paso es siempre **system.search**.
- **Scholar**: Experto académico. Usa la herramienta **scholar.check-sima** para tareas y universidad.

#### REGLAS DE ORO:
1. **FULL TOOL NAMES**: Usa el nombre EXACTO (ej: "system.search").
2. **JSON ONLY**: Si decides actuar, responde **SOLO** con el JSON. Sin texto extra.
3. **NO ECHO**: No repitas el prompt del usuario en tu razonamiento. Ve directo al grano.
4. **ACTION ORIENTED**: Si la tarea pide crear, escribir o buscar, **DEBES** usar una herramienta.

#### FORMATO DE RESPUESTA:
{
  "thought": "Breve razonamiento",
  "tool": "nombre.herramienta",
  "params": { "arg1": "valor" }
}

Si has terminado, responde con un mensaje final amigable sin JSON.
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
