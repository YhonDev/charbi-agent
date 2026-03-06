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
Eres la Inteligencia de Planificación Central de Charbi. Desglosa el objetivo en un Grafo de Tareas (DAG).

OBJETIVO: "${goal}"

AGENTES:
- 'researcher': Para 'system.search', obtener datos web.
- 'coder': Para 'system.write', 'system.read', procesar datos.
- 'operator': Para 'system.execute', comandos shell.

REGLAS:
1. Pasos ATÓMICOS: (t1: buscar, t2: procesar, t3: guardar).
2. Usa 'depends_on' para que t2 espere a t1.
3. Charbi pasará automáticamente el resultado de t1 al contexto de t2.
4. Responde EXCLUSIVAMENTE con el JSON.

FORMATO:
{
  "tasks": [
    {"id": "t1", "description": "Buscar noticias sobre X", "agent": "researcher"},
    {"id": "t2", "description": "Analizar y resumir los resultados de t1", "agent": "coder", "depends_on": ["t1"]},
    {"id": "t3", "description": "Guardar el resumen en un archivo .md", "agent": "coder", "depends_on": ["t2"]}
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
