// charbi/kernel/plan_engine.ts
import { log } from './logger';
import { recordJournal } from './journal';
import { safeToolCall } from './safe_tool_call';
import { updateSessionState, killSession, getSession } from './process_manager';
import { SessionState, RiskLevel } from './types';
import { remember, recall, MemoryType } from './memory_engine';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface PlanStep {
  id: string;
  description: string;
  action: {
    type: string;
    details: any;
    fn: (opts: { signal: AbortSignal }) => Promise<any>;
  };
  status: StepStatus;
  result?: any;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  sessionId: string;
  agent: string;
  objective: string;
  steps: PlanStep[];
  createdAt: number;
  completedAt?: number;
  outcome: 'pending' | 'success' | 'partial' | 'failed' | 'aborted';
}

/**
 * createPlan
 * Builds a formal, auditable execution plan from an objective and steps.
 */
export function createPlan(
  sessionId: string,
  agent: string,
  objective: string,
  steps: Omit<PlanStep, 'status' | 'result' | 'error'>[]
): ExecutionPlan {
  const plan: ExecutionPlan = {
    id: `plan-${Date.now()}`,
    sessionId,
    agent,
    objective,
    steps: steps.map(s => ({ ...s, status: 'pending' as StepStatus })),
    createdAt: Date.now(),
    outcome: 'pending'
  };

  recordJournal({
    sessionId,
    type: 'ACTION_RECORD',
    level: 'INFO',
    data: { event: 'PLAN_CREATED', planId: plan.id, objective, stepCount: steps.length }
  });

  return plan;
}

/**
 * executePlan
 * Runs each step sequentially under full governance:
 * - Budget is checked per step
 * - Supervisor inspects each action
 * - If a step fails, the plan halts (fail-fast)
 * - AbortSignal is respected physically
 */
export async function executePlan(plan: ExecutionPlan): Promise<ExecutionPlan> {
  const session = getSession(plan.sessionId);
  if (!session) {
    plan.outcome = 'failed';
    return plan;
  }

  updateSessionState(plan.sessionId, 'PLANNING');
  log({ level: 'INFO', module: 'PlanEngine', message: `Executing plan: ${plan.objective}`, sessionId: plan.sessionId });

  let successCount = 0;

  for (const step of plan.steps) {
    // Pre-flight: Check if session was aborted
    if (session.abortController.signal.aborted) {
      step.status = 'skipped';
      plan.outcome = 'aborted';
      log({ level: 'WARN', module: 'PlanEngine', message: `Plan aborted before step: ${step.id}`, sessionId: plan.sessionId });
      break;
    }

    step.status = 'running';
    recordJournal({
      sessionId: plan.sessionId,
      type: 'ACTION_RECORD',
      level: 'INFO',
      data: { event: 'STEP_START', planId: plan.id, stepId: step.id, description: step.description }
    });

    try {
      const context = {
        id: step.id,
        sessionId: plan.sessionId,
        agent: plan.agent,
        timestamp: Date.now()
      };

      const result = await safeToolCall({}, {
        context,
        type: step.action.type,
        details: step.action.details,
        fn: step.action.fn
      });

      step.status = 'success';
      step.result = result;
      successCount++;

      recordJournal({
        sessionId: plan.sessionId,
        type: 'ACTION_RECORD',
        level: 'INFO',
        data: { event: 'STEP_SUCCESS', planId: plan.id, stepId: step.id }
      });

    } catch (e: any) {
      step.status = 'failed';
      step.error = e.message;

      recordJournal({
        sessionId: plan.sessionId,
        type: 'SECURITY_INCIDENT',
        level: 'ERROR',
        data: { event: 'STEP_FAILED', planId: plan.id, stepId: step.id, error: e.message }
      });

      // Fail-fast: stop the plan
      plan.outcome = 'failed';
      log({ level: 'ERROR', module: 'PlanEngine', message: `Plan halted at step ${step.id}: ${e.message}`, sessionId: plan.sessionId });
      break;
    }
  }

  if (plan.outcome === 'pending') {
    plan.outcome = successCount === plan.steps.length ? 'success' : 'partial';
  }

  plan.completedAt = Date.now();
  updateSessionState(plan.sessionId, plan.outcome === 'success' ? 'COMPLETED' : 'FAILED');

  log({ level: 'INFO', module: 'PlanEngine', message: `Plan finished: ${plan.outcome} (${successCount}/${plan.steps.length})`, sessionId: plan.sessionId });

  // Auto-commit episodic memory
  commitToMemory(plan);

  return plan;
}

/**
 * rewritePlan
 * Modifies pending steps mid-execution under governance.
 * Only pending steps can be replaced. Running/completed steps are immutable.
 */
export function rewritePlan(
  plan: ExecutionPlan,
  newSteps: Omit<PlanStep, 'status' | 'result' | 'error'>[]
): ExecutionPlan {
  const mutableSteps = plan.steps.filter(s => s.status !== 'pending');
  const rewritten = newSteps.map(s => ({ ...s, status: 'pending' as StepStatus }));

  plan.steps = [...mutableSteps, ...rewritten];

  recordJournal({
    sessionId: plan.sessionId,
    type: 'ACTION_RECORD',
    level: 'INFO',
    data: {
      event: 'PLAN_REWRITTEN',
      planId: plan.id,
      originalSteps: mutableSteps.length,
      newSteps: rewritten.length
    }
  });

  log({ level: 'INFO', module: 'PlanEngine', message: `Plan rewritten: ${rewritten.length} new steps added`, sessionId: plan.sessionId });

  return plan;
}

/**
 * commitToMemory
 * Stores the execution result as episodic memory for future plan improvement.
 */
function commitToMemory(plan: ExecutionPlan) {
  remember({
    type: 'episodic',
    sessionId: plan.sessionId,
    agent: plan.agent,
    content: {
      objective: plan.objective,
      outcome: plan.outcome,
      stepsTotal: plan.steps.length,
      stepsSuccess: plan.steps.filter(s => s.status === 'success').length,
      stepsFailed: plan.steps.filter(s => s.status === 'failed').length,
      duration: plan.completedAt ? plan.completedAt - plan.createdAt : null,
      failedStepIds: plan.steps.filter(s => s.status === 'failed').map(s => s.id),
      failedReasons: plan.steps.filter(s => s.status === 'failed').map(s => s.error)
    },
    tags: ['mission', plan.outcome, plan.agent]
  });
}
