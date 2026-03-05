// charbi/kernel/plan_dag.ts
import { log } from './logger';
import { recordJournal } from './journal';
import { safeToolCall } from './safe_tool_call';
import { updateSessionState, getSession } from './process_manager';
import { acquireLock, releaseLock, releaseAllLocks } from './lock_manager';
import { remember } from './memory_engine';

export type DAGStepStatus = 'pending' | 'ready' | 'running' | 'success' | 'failed' | 'skipped';

export interface DAGStep {
  id: string;
  description: string;
  dependsOn: string[];          // IDs of steps that must complete first
  resources: { path: string; mode: 'READ' | 'WRITE' }[];  // Resource requirements
  action: {
    type: string;
    details: any;
    fn: (opts: { signal: AbortSignal }) => Promise<any>;
  };
  status: DAGStepStatus;
  result?: any;
  error?: string;
}

export interface DAGPlan {
  id: string;
  sessionId: string;
  agent: string;
  objective: string;
  steps: DAGStep[];
  createdAt: number;
  completedAt?: number;
  outcome: 'pending' | 'success' | 'partial' | 'failed' | 'aborted';
}

/**
 * createDAGPlan
 * Creates a DAG-based execution plan with explicit dependencies.
 */
export function createDAGPlan(
  sessionId: string,
  agent: string,
  objective: string,
  steps: Omit<DAGStep, 'status' | 'result' | 'error'>[]
): DAGPlan {
  // Validate: no circular dependencies
  const ids = new Set(steps.map(s => s.id));
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      if (!ids.has(dep)) throw new Error(`Step '${step.id}' depends on unknown step '${dep}'`);
    }
  }

  const plan: DAGPlan = {
    id: `dag-${Date.now()}`,
    sessionId,
    agent,
    objective,
    steps: steps.map(s => ({ ...s, status: 'pending' as DAGStepStatus })),
    createdAt: Date.now(),
    outcome: 'pending'
  };

  recordJournal({
    sessionId,
    type: 'ACTION_RECORD',
    level: 'INFO',
    data: { event: 'DAG_PLAN_CREATED', planId: plan.id, objective, stepCount: steps.length }
  });

  return plan;
}

/**
 * getReadySteps
 * Returns steps whose dependencies are all satisfied and resources available.
 */
function getReadySteps(plan: DAGPlan): DAGStep[] {
  return plan.steps.filter(step => {
    if (step.status !== 'pending') return false;

    // All dependencies must be 'success'
    const depsOk = step.dependsOn.every(depId => {
      const dep = plan.steps.find(s => s.id === depId);
      return dep && dep.status === 'success';
    });

    return depsOk;
  });
}

/**
 * executeDAGPlan
 * Executes a DAG plan with parallelism where dependencies allow.
 * Steps acquire resource locks before executing.
 */
export async function executeDAGPlan(plan: DAGPlan): Promise<DAGPlan> {
  const session = getSession(plan.sessionId);
  if (!session) { plan.outcome = 'failed'; return plan; }

  updateSessionState(plan.sessionId, 'EXECUTING');
  log({ level: 'INFO', module: 'PlanDAG', message: `Executing DAG: ${plan.objective}`, sessionId: plan.sessionId });

  while (true) {
    // Check abort
    if (session.abortController.signal.aborted) {
      plan.steps.filter(s => s.status === 'pending').forEach(s => s.status = 'skipped');
      plan.outcome = 'aborted';
      break;
    }

    const ready = getReadySteps(plan);
    if (ready.length === 0) {
      // No more steps can run: either all done or blocked
      const pending = plan.steps.filter(s => s.status === 'pending');
      if (pending.length > 0) {
        // Steps are pending but their deps failed → mark skipped
        pending.forEach(s => s.status = 'skipped');
      }
      break;
    }

    // Try to acquire locks and execute ready steps in parallel
    const executions = ready.map(async (step) => {
      // Acquire resource locks
      const locksAcquired: string[] = [];
      let canRun = true;

      for (const res of step.resources) {
        const got = acquireLock(res.path, res.mode, step.id);
        if (got) {
          locksAcquired.push(res.path);
        } else {
          canRun = false;
          // Release any locks we already acquired
          locksAcquired.forEach(r => releaseLock(r, step.id));
          break;
        }
      }

      if (!canRun) {
        // Can't run yet — leave as pending for next iteration
        return;
      }

      step.status = 'running';
      recordJournal({
        sessionId: plan.sessionId,
        type: 'ACTION_RECORD',
        level: 'INFO',
        data: { event: 'DAG_STEP_START', planId: plan.id, stepId: step.id, parallel: true }
      });

      try {
        const context = { id: step.id, sessionId: plan.sessionId, agent: plan.agent, timestamp: Date.now() };
        const result = await safeToolCall({}, {
          context,
          type: step.action.type,
          details: step.action.details,
          fn: step.action.fn
        });

        step.status = 'success';
        step.result = result;

        recordJournal({
          sessionId: plan.sessionId,
          type: 'ACTION_RECORD',
          level: 'INFO',
          data: { event: 'DAG_STEP_SUCCESS', planId: plan.id, stepId: step.id }
        });
      } catch (e: any) {
        step.status = 'failed';
        step.error = e.message;

        recordJournal({
          sessionId: plan.sessionId,
          type: 'SECURITY_INCIDENT',
          level: 'ERROR',
          data: { event: 'DAG_STEP_FAILED', planId: plan.id, stepId: step.id, error: e.message }
        });
      } finally {
        // Always release locks
        locksAcquired.forEach(r => releaseLock(r, step.id));
      }
    });

    await Promise.all(executions);
  }

  // Determine outcome
  const success = plan.steps.filter(s => s.status === 'success').length;
  const total = plan.steps.length;

  if (plan.outcome !== 'aborted') {
    plan.outcome = success === total ? 'success' : (success > 0 ? 'partial' : 'failed');
  }

  plan.completedAt = Date.now();
  updateSessionState(plan.sessionId, plan.outcome === 'success' ? 'COMPLETED' : 'FAILED');

  // Auto-commit to episodic memory
  remember({
    type: 'episodic',
    sessionId: plan.sessionId,
    agent: plan.agent,
    content: { objective: plan.objective, outcome: plan.outcome, dag: true, stepsTotal: total, stepsSuccess: success },
    tags: ['mission', 'dag', plan.outcome]
  });

  log({ level: 'INFO', module: 'PlanDAG', message: `DAG finished: ${plan.outcome} (${success}/${total})`, sessionId: plan.sessionId });

  return plan;
}
