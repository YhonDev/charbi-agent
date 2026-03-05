// kernel/reflection/reflection_engine.ts
import { queryLLM } from "../llm_connector";
import { TaskGraph } from "../task_graph/task_graph";

export class ReflectionEngine {
  /**
   * Analiza un proyecto completo (grafo ejecutado) para extraer aprendizajes estratégicos.
   */
  async reflectOnProject(graph: TaskGraph): Promise<any> {
    const history = graph.getAllTasks().map(t => ({
      id: t.id,
      desc: t.description,
      result: t.result,
      error: t.error
    }));

    const prompt = `
Eres el Reflection Engine de Charbi. Analiza la ejecución de este proyecto y extrae conclusiones.

OBJETIVO DEL PROYECTO:
"${graph.getGoal()}"

HISTORIAL DE TAREAS:
${JSON.stringify(history, null, 2)}

PREGUNTAS DE REFLEXIÓN:
1. ¿Se cumplió el objetivo principal?
2. ¿Qué obstáculos se encontraron y cómo se superaron?
3. ¿Qué nuevos conocimientos sobre el sistema o el usuario podemos guardar?

Responde únicamente con un JSON:
{
  "summary": "...",
  "success": true/false,
  "learnings": ["..."],
  "relations": [{"s": "...", "r": "...", "o": "..."}]
}
`;

    console.log('[ReflectionEngine] Analizando proyecto finalizado...');
    const res = await queryLLM(prompt, "Reflection Engine");

    if (res.success && res.content) {
      try {
        const match = res.content.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
      } catch (e) {
        console.error('[ReflectionEngine] Error parsing reflection JSON:', e);
      }
    }
    return null;
  }
}

export const reflectionEngine = new ReflectionEngine();
