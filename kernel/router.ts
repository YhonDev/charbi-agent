import { v4 as uuid } from 'uuid';
import { queryLLM } from './llm_connector';

export type TaskAnalysis = {
  id: string;
  complexity: number;
  risk: 'low' | 'medium' | 'high';
  specialist: 'director' | 'coder' | 'researcher' | 'operator';
  requiresTools: boolean;
  reasoning: string;
};

/**
 * Advanced Cognitive Router (Triage)
 * Uses LLM to determine the best specialist for the task.
 */
export async function analyzeTask(userInput: string): Promise<TaskAnalysis> {
  const complexity = guessComplexity(userInput);
  const triageId = uuid();

  try {
    const triagePrompt = `
Analiza la solicitud del usuario y determina el especialista y la complejidad del proyecto.

ESPECIALISTAS:
- 'director': Saludos, charla general, ayuda sobre Charbi o supervisión de tareas. Es capaz de usar herramientas de sistema para obtener contexto si lo cree necesario.
- 'coder': Consultas de programación, depuración, creación de scripts o proyectos de código.
- 'researcher': Búsqueda de información, noticias o investigación profunda.
- 'operator': Comandos de shell, gestión de archivos y sistema.

COMPLEJIDAD (0.0 a 1.0):
- 0.1: Pregunta directa de conocimiento (incluyendo "cómo funciona X" o "resumen de Y"). Charla educativa.
- 0.6+: Solicitud de ACCIÓN (ej: "crea un archivo", "investiga y guarda", "haz un proyecto"). 
- 0.8+: Proyectos multi-paso complejos.

REGLA CRÍTICA PARA CODER:
- Si el usuario pregunta "qué es Java" o "cómo funciona un bucle", complejidad = 0.1 (Simple Chat).
- Si el usuario dice "crea un script en Java" o "ejecuta este código", complejidad = 0.7 (Modo Proyecto).

SOLICITUD: "${userInput}"

Responde UNICAMENTE en formato JSON:
{"specialist": "director|coder|researcher|operator", "reasoning": "...", "risk": "low|medium|high", "complexity": 0.X}
`;

    const res = await queryLLM(triagePrompt, "System Triage Engine");
    if (res.success && res.content) {
      const match = res.content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          id: triageId,
          complexity: parsed.complexity || complexity,
          risk: parsed.risk || (complexity > 0.7 ? 'high' : 'low'),
          specialist: parsed.specialist || 'director',
          requiresTools: (parsed.complexity || complexity) > 0.3,
          reasoning: parsed.reasoning || 'Clasificación por LLM'
        };
      }
    }
  } catch (e) {
    console.warn('[Router] LLM Triage failed, falling back to heuristics:', e);
  }

  // FALLBACK Heuristics
  let specialist: TaskAnalysis['specialist'] = 'director';
  if (userInput.match(/program|code|debug|script|refactor/i)) specialist = 'coder';
  else if (userInput.match(/investigar|buscar|noticias|web|search/i)) specialist = 'researcher';
  else if (userInput.match(/install|config|bash|shell|run/i)) specialist = 'operator';

  return {
    id: triageId,
    complexity,
    risk: complexity > 0.7 ? 'high' : 'low',
    specialist,
    requiresTools: complexity > 0.3,
    reasoning: 'Clasificación por heurística (Fallback)'
  };
}

function guessComplexity(s: string): number {
  const lengthScore = Math.min(0.4, s.length / 500);
  const keywordScore = s.match(/investigar|crear|build|implement|buscar|noticia|news|file|archivo/i) ? 0.6 : 0.2;
  return Math.min(1, lengthScore + keywordScore);
}
