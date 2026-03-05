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
Eres el Task Planner de Charbi. Tu objetivo es descomponer un objetivo complejo en una serie de tareas atómicas que puedan ser ejecutadas por agentes especialistas.

OBJETIVO DEL USUARIO:
"${goal}"

AGENTES DISPONIBLES:
- 'director': Coordinación, resúmenes, interacción simple.
- 'coder': Programación, scripts, debug, archivos de código.
- 'researcher': Búsqueda web, investigación, síntesis de datos.
- 'operator': Comandos de shell, instalaciones, gestión de sistema.

REGLAS:
1. Define dependencias si una tarea necesita el resultado de otra (u_id).
2. Cada tarea debe tener una descripción clara.
3. Devuelve únicamente un objeto JSON válido.

FORMATO JSON ESPERADO:
{
  "tasks": [
    {
      "id": "t1",
      "description": "Investigar requisitos de la API",
      "agent": "researcher"
    },
    {
      "id": "t2",
      "description": "Crear el archivo principal",
      "agent": "coder",
      "depends_on": ["t1"]
    }
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
