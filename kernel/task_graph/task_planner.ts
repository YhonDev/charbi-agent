// kernel/task_graph/task_planner.ts
import { queryLLM } from "../llm_connector";
import { TaskGraph } from "./task_graph";
import { Task } from "./task_types";

export class TaskPlanner {
  /**
   * Genera un plan estructurado (grafo) basado en un objetivo del usuario.
   */
  async plan(goal: string): Promise<TaskGraph> {
    const prompt = `
Eres la Inteligencia de Planificación Central de Charbi. Tu misión es desglosar objetivos complejos en un Grafo de Tareas (DAG).

OBJETIVO: "${goal}"

AGENTES ESTRATÉGICOS:
- 'researcher': Para obtener datos externos, navegar o investigar.
- 'coder': Para procesar datos, escribir archivos, scripts o lógica.
- 'operator': Para interactuar con el sistema operativo y shell.
- 'director': Para resumir resultados y dar la respuesta final al usuario.

REGLAS CRÍTICAS:
1. Divide la tarea en pasos ATÓMICOS (ej: 1. Buscar noticias, 2. Resumir, 3. Crear archivo).
2. Usa dependencias (depends_on) para que el flujo sea lógico.
3. Si la tarea es "investigar X y guardar en Y", necesitas al menos 3 tareas: (t1: investigar, t2: procesar/resumir, t3: guardar).
4. Responde EXCLUSIVAMENTE con el JSON.

FORMATO:
{
  "tasks": [
    {"id": "t1", "description": "...", "agent": "researcher"},
    {"id": "t2", "description": "...", "agent": "coder", "depends_on": ["t1"]}
  ]
}
`;

    console.log('[TaskPlanner] Generando plan para:', goal);
    const res = await queryLLM(prompt, "Task Planner Engine");

    const graph = new TaskGraph(goal);

    if (res.success && res.content) {
      try {
        const match = res.content.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          for (const t of parsed.tasks) {
            const task: Task = {
              id: t.id,
              description: t.description,
              agent: t.agent,
              depends_on: t.depends_on || [],
              status: 'pending'
            };
            graph.addTask(task);
          }
        }
      } catch (e) {
        console.error('[TaskPlanner] Error parsing plan JSON:', e);
      }
    }

    return graph;
  }
}

export const taskPlanner = new TaskPlanner();
