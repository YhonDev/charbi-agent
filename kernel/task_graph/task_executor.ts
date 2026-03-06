// kernel/task_graph/task_executor.ts
import { TaskGraph } from "./task_graph";
import { emitEvent } from "../event_bus";
import { v4 as uuidv4 } from 'uuid';

export interface ExecutorOptions {
  onTaskStart?: (task: any) => void;
  onTaskComplete?: (task: any) => void;
}

import { reflectionEngine } from "../reflection/reflection_engine";
import { memoryClient } from "../cognition/memory_client";

export class TaskExecutor {
  /**
   * Ejecuta el grafo de tareas de forma secuencial.
   */
  async execute(graph: TaskGraph, orchestrator: any) {
    console.log(`[TaskExecutor] Iniciando ejecución de proyecto: ${graph.getGoal()}`);

    while (true) {
      const task = graph.getNextExecutable();
      if (!task) break;

      console.log(`[TaskExecutor] Ejecutando: [${task.id}] ${task.description}`);

      this.emitEvent('TASK_STARTED', {
        taskId: task.id,
        description: task.description,
        agent: task.agent
      });

      task.status = "running";

      try {
        // Recopilar resultados de dependencias para dar contexto al agente
        const dependencies = task.depends_on || [];
        const depResults = dependencies.map(id => {
          const t = graph.getTask(id);
          return t ? `[Result of ${t.id} (${t.description})]: ${t.result}` : '';
        }).join('\n\n');

        const context = depResults ? `PREVIOUS CONTEXT:\n${depResults}` : '';

        // Delegar la ejecución de la tarea al Orchestrator
        const result = await orchestrator.processInternalTask(task, context);

        graph.updateStatus(task.id, "completed", result);
        this.emitEvent('TASK_COMPLETED', { taskId: task.id, result });

      } catch (error: any) {
        console.error(`[TaskExecutor] Error en tarea ${task.id}:`, error);
        graph.updateStatus(task.id, "failed", null, error.message);
        this.emitEvent('TASK_FAILED', { taskId: task.id, error: error.message });
        break; // Detener ejecución si falla una tarea crítica
      }
    }

    // REFLECTION PHASE
    if (graph.isCompleted() || graph.isFailed()) {
      const reflection = await reflectionEngine.reflectOnProject(graph);
      if (reflection) {
        console.log(`[TaskExecutor] Reflexión completada: ${reflection.summary}`);
        // Guardar aprendizajes de proyecto (estratégicos)
        const { memoryManager } = await import('../cognition/memory_manager');
        for (const l of reflection.learnings || []) {
          await memoryManager.store(`[Project Learning] ${l}`, 'project_reflection');
        }
        for (const rel of reflection.relations || []) {
          await memoryClient.call('graph.add_relation', {
            subject: rel.s,
            relation: rel.r,
            object: rel.o
          });
        }
      }
    }

    if (graph.isCompleted()) {
      console.log('[TaskExecutor] Proyecto completado con éxito! ✅');
      this.emitEvent('PROJECT_COMPLETED', { goal: graph.getGoal() });
    } else {
      console.warn('[TaskExecutor] El proyecto terminó con errores o tareas pendientes.');
    }
  }

  private emitEvent(type: string, payload: any) {
    emitEvent({
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      origin: 'task_executor',
      payload
    });
  }
}

export const taskExecutor = new TaskExecutor();
