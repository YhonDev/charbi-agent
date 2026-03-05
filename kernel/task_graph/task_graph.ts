// kernel/task_graph/task_graph.ts
import { Task, TaskStatus } from "./task_types";

export class TaskGraph {
  private tasks: Map<string, Task> = new Map();
  private goal: string = "";

  constructor(goal: string = "") {
    this.goal = goal;
  }

  setGoal(goal: string) {
    this.goal = goal;
  }

  getGoal(): string {
    return this.goal;
  }

  addTask(task: Task) {
    this.tasks.set(task.id, task);
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Identifica la siguiente tarea que puede ser ejecutada.
   * Una tarea es ejecutable si está 'pending' y todas sus dependencias están 'completed'.
   */
  getNextExecutable(): Task | null {
    for (const task of this.tasks.values()) {
      if (task.status !== "pending") continue;

      const deps = task.depends_on || [];
      const ready = deps.every(id => {
        const dep = this.tasks.get(id);
        return dep?.status === "completed";
      });

      // Si alguna dependencia falló, marcamos esta tarea como fallida/saltada?
      const anyDepFailed = deps.some(id => this.tasks.get(id)?.status === "failed");
      if (anyDepFailed) {
        task.status = "failed";
        task.error = "Dependency failed";
        continue;
      }

      if (ready) return task;
    }
    return null;
  }

  updateStatus(id: string, status: TaskStatus, result?: any, error?: string) {
    const task = this.tasks.get(id);
    if (!task) return;

    task.status = status;
    if (result !== undefined) task.result = result;
    if (error !== undefined) task.error = error;
  }

  isCompleted(): boolean {
    const all = this.getAllTasks();
    if (all.length === 0) return false;
    return all.every(t => t.status === "completed");
  }

  isFailed(): boolean {
    return this.getAllTasks().some(t => t.status === "failed");
  }

  getProgress(): number {
    const all = this.getAllTasks();
    if (all.length === 0) return 0;
    const completed = all.filter(t => t.status === "completed").length;
    return (completed / all.length) * 100;
  }
}
