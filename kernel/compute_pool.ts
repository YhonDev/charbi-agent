// charbi/kernel/compute_pool.ts
import { Worker } from 'worker_threads';
import path from 'path';
import { log } from './logger';

export type TaskType = 'hash' | 'hash-chain' | 'analysis' | 'parse-json';

interface PendingTask {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  submittedAt: number;
}

const WORKER_SCRIPT = path.join(process.cwd(), 'kernel', 'workers', 'heavy_task.js');
const POOL_SIZE = 2; // Conservative: 2 workers max
const TASK_TIMEOUT_MS = 10000;

let workers: Worker[] = [];
let taskCounter = 0;
let currentWorker = 0;
const pendingTasks: Map<string, PendingTask> = new Map();

/**
 * initPool
 * Creates the worker thread pool. Call once at startup.
 */
export function initPool(): void {
  if (workers.length > 0) return; // Already initialized

  for (let i = 0; i < POOL_SIZE; i++) {
    const worker = new Worker(WORKER_SCRIPT);

    worker.on('message', (msg: { taskId: string; success: boolean; result?: any; error?: string }) => {
      const pending = pendingTasks.get(msg.taskId);
      if (!pending) return;
      pendingTasks.delete(msg.taskId);

      const elapsed = Date.now() - pending.submittedAt;
      if (msg.success) {
        log({ level: 'INFO', module: 'ComputePool', message: `Task ${msg.taskId} completed in ${elapsed}ms` });
        pending.resolve(msg.result);
      } else {
        log({ level: 'ERROR', module: 'ComputePool', message: `Task ${msg.taskId} failed: ${msg.error}` });
        pending.reject(new Error(msg.error));
      }
    });

    worker.on('error', (err) => {
      log({ level: 'ERROR', module: 'ComputePool', message: `Worker error: ${err.message}` });
    });

    workers.push(worker);
  }

  log({ level: 'INFO', module: 'ComputePool', message: `Pool initialized: ${POOL_SIZE} workers` });
}

/**
 * runHeavyTask
 * Offloads a computation to the worker pool.
 * Returns a Promise that resolves with the result.
 */
export function runHeavyTask<T = any>(type: TaskType, payload: any): Promise<T> {
  if (workers.length === 0) initPool();

  const taskId = `task-${++taskCounter}`;
  const worker = workers[currentWorker % workers.length];
  currentWorker++;

  return new Promise<T>((resolve, reject) => {
    pendingTasks.set(taskId, { resolve, reject, submittedAt: Date.now() });

    // Timeout protection
    setTimeout(() => {
      if (pendingTasks.has(taskId)) {
        pendingTasks.delete(taskId);
        reject(new Error(`Task ${taskId} timed out after ${TASK_TIMEOUT_MS}ms`));
      }
    }, TASK_TIMEOUT_MS);

    worker.postMessage({ taskId, type, payload });
  });
}

/**
 * shutdownPool
 * Terminates all worker threads gracefully.
 */
export function shutdownPool(): void {
  for (const worker of workers) {
    worker.terminate();
  }
  workers = [];
  pendingTasks.clear();
  log({ level: 'INFO', module: 'ComputePool', message: 'Pool shut down' });
}
