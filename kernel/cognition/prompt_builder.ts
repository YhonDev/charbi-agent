// kernel/cognition/prompt_builder.ts
// Constructor avanzado de prompts para Charbi.
// Inyecta: Identidad, Misión, Memoria (RAG), Herramientas y Contexto.

import { cognitionLoader } from '../cognition_loader';
import { memoryManager } from './memory_manager';

export interface PromptContext {
  agentName: string;
  toolsSchema: string;
  userInput: string;
  history?: any[];
}

class PromptBuilder {
  /** Construye el prompt completo enriquecido con memoria */
  buildAgentPrompt(context: PromptContext): string {
    const { agentName, toolsSchema, userInput } = context;

    // 1. Obtener Cognición base (SOUL, MISSION, etc.)
    const baseCognition = cognitionLoader.buildSystemPrompt(agentName, toolsSchema);

    // 2. Recuperar recuerdos relevantes (RAG básico)
    const relevantMemories = memoryManager.search(userInput, 3);
    const memoryPart = relevantMemories.length > 0
      ? `\n### CONTEXTO RECUPERADO (MEMORIA):\n${relevantMemories.map(m => `- [${new Date(m.timestamp).toLocaleDateString()}] ${m.content}`).join('\n')}\n`
      : '';

    // 3. Instrucciones de ciclo cognitivo
    const cognitiveLoopPart = `
### COGNITIVE LOOP INSTRUCTIONS:
1. **THINK**: Antes de actuar, analiza la intención del usuario y la situación.
2. **PLAN**: Divide la tarea en pasos lógicos.
3. **ACT**: Usa las herramientas disponibles.
4. **OBSERVE**: Analiza los resultados de las herramientas.
5. **REFLECT**: Evalúa si el resultado es satisfactorio o si necesitas más pasos.

Responde siempre en formato JSON si necesitas una herramienta:
{"thought": "descripción de tu razonamiento", "tool": "nombre", "params": {...}}
O responde en texto normal si has terminado la tarea.
`;

    return `
${baseCognition}
${memoryPart}
${cognitiveLoopPart}
`.trim();
  }
}

export const promptBuilder = new PromptBuilder();
export default promptBuilder;
