// kernel/task_graph/task_types.ts

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface Task {
  id: string;
  description: string;
  agent: 'director' | 'coder' | 'researcher' | 'operator';
  tool?: string;
  depends_on?: string[];
  status: TaskStatus;
  result?: any;
  error?: string;
  metadata?: any;
}

export interface TaskGraphState {
  goal: string;
  tasks: Task[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
}
