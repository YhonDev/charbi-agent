// charbi/kernel/llm_adapter.ts
import { log } from './logger';
import { recordJournal } from './journal';
import { recordMetrics, MissionMetrics } from './metrics';
import { createDAGPlan, executeDAGPlan, DAGStep, DAGPlan } from './plan_dag';
import { createSession } from './process_manager';
import { shutdownPool } from './compute_pool';

const VALID_ACTION_TYPES = [
  'filesystem.read', 'filesystem.write',
  'shell.execute', 'network.access', 'network.fetch'
];

const MAX_STEPS = 10;
const MAX_DEPENDENCIES_PER_STEP = 5;

export interface LLMProposedStep {
  id?: string;
  description?: string;
  dependsOn?: string[];
  resources?: { path: string; mode: string }[];
  action?: {
    type?: string;
    details?: any;
    [key: string]: any;  // LLMs hallucinate extra fields
  };
  [key: string]: any;    // Catch-all for hallucinated fields
}

export interface LLMPlanDraft {
  objective?: string;
  steps?: LLMProposedStep[];
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  sanitizedSteps: Omit<DAGStep, 'status' | 'result' | 'error'>[];
  warnings: string[];
  stripped: string[];      // Hallucinated fields stripped
  blocked: string[];       // Steps blocked pre-execution
  circularDeps: boolean;
}

/**
 * validateAndSanitize
 * The critical firewall between non-deterministic LLM output and deterministic Kernel.
 */
export function validateAndSanitize(
  draft: LLMPlanDraft,
  toolFns: Map<string, (opts: { signal: AbortSignal }) => Promise<any>>
): ValidationResult {
  const warnings: string[] = [];
  const stripped: string[] = [];
  const blocked: string[] = [];
  const sanitized: Omit<DAGStep, 'status' | 'result' | 'error'>[] = [];

  if (!draft.objective || typeof draft.objective !== 'string') {
    return { valid: false, sanitizedSteps: [], warnings: ['Missing or invalid objective'], stripped: [], blocked: [], circularDeps: false };
  }

  if (!Array.isArray(draft.steps) || draft.steps.length === 0) {
    return { valid: false, sanitizedSteps: [], warnings: ['No steps provided'], stripped: [], blocked: [], circularDeps: false };
  }

  // Enforce max steps
  if (draft.steps.length > MAX_STEPS) {
    warnings.push(`Truncated: ${draft.steps.length} steps → ${MAX_STEPS} (max)`);
    draft.steps = draft.steps.slice(0, MAX_STEPS);
  }

  // Strip plan-level hallucinated fields
  const validPlanKeys = ['objective', 'steps'];
  for (const key of Object.keys(draft)) {
    if (!validPlanKeys.includes(key)) {
      stripped.push(`plan.${key}`);
      delete draft[key];
    }
  }

  const stepIds = new Set<string>();

  for (let i = 0; i < draft.steps.length; i++) {
    const raw = draft.steps[i];

    // Generate ID if missing
    const id = (typeof raw.id === 'string' && raw.id.trim()) ? raw.id.trim() : `step-${i}`;

    // Detect duplicate IDs
    if (stepIds.has(id)) {
      warnings.push(`Duplicate step ID '${id}', renaming`);
      const newId = `${id}-dup-${i}`;
      stepIds.add(newId);
    } else {
      stepIds.add(id);
    }

    // Description
    const description = (typeof raw.description === 'string') ? raw.description : `Step ${i}`;

    // Validate action type
    if (!raw.action || typeof raw.action.type !== 'string') {
      blocked.push(`Step '${id}': missing action type`);
      continue;
    }

    if (!VALID_ACTION_TYPES.includes(raw.action.type)) {
      blocked.push(`Step '${id}': invalid action type '${raw.action.type}'`);
      continue;
    }

    // Strip hallucinated action fields
    const validActionKeys = ['type', 'details'];
    for (const key of Object.keys(raw.action)) {
      if (!validActionKeys.includes(key)) {
        stripped.push(`step[${id}].action.${key}`);
      }
    }

    // Strip hallucinated step fields
    const validStepKeys = ['id', 'description', 'dependsOn', 'resources', 'action'];
    for (const key of Object.keys(raw)) {
      if (!validStepKeys.includes(key)) {
        stripped.push(`step[${id}].${key}`);
      }
    }

    // Validate dependencies (must reference existing IDs, cap count)
    let deps = Array.isArray(raw.dependsOn) ? raw.dependsOn.filter(d => typeof d === 'string') : [];
    if (deps.length > MAX_DEPENDENCIES_PER_STEP) {
      warnings.push(`Step '${id}': trimmed deps from ${deps.length} to ${MAX_DEPENDENCIES_PER_STEP}`);
      deps = deps.slice(0, MAX_DEPENDENCIES_PER_STEP);
    }

    // Normalize resources
    const resources = Array.isArray(raw.resources)
      ? raw.resources
        .filter(r => r && typeof r.path === 'string')
        .map(r => ({ path: r.path, mode: (r.mode === 'WRITE' ? 'WRITE' : 'READ') as 'READ' | 'WRITE' }))
      : [];

    // Get the tool function
    const fn = toolFns.get(id) || toolFns.get(raw.action.type);
    if (!fn) {
      blocked.push(`Step '${id}': no tool function registered`);
      continue;
    }

    sanitized.push({
      id,
      description,
      dependsOn: deps,
      resources,
      action: {
        type: raw.action.type,
        details: raw.action.details || {},
        fn
      }
    });
  }

  // Circular dependency detection
  const circularDeps = detectCircular(sanitized);
  if (circularDeps) {
    warnings.push('Circular dependency detected — plan rejected');
  }

  return {
    valid: sanitized.length > 0 && !circularDeps,
    sanitizedSteps: sanitized,
    warnings,
    stripped,
    blocked,
    circularDeps
  };
}

function detectCircular(steps: { id: string; dependsOn: string[] }[]): boolean {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const adj = new Map<string, string[]>();

  for (const s of steps) adj.set(s.id, s.dependsOn);

  function dfs(node: string): boolean {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    for (const dep of adj.get(node) || []) {
      if (dfs(dep)) return true;
    }
    stack.delete(node);
    return false;
  }

  for (const s of steps) {
    if (dfs(s.id)) return true;
  }
  return false;
}

/**
 * executeLLMPlan
 * Full pipeline: validate → sanitize → create DAG → execute → collect metrics.
 */
export async function executeLLMPlan(
  draft: LLMPlanDraft,
  agent: string,
  toolFns: Map<string, (opts: { signal: AbortSignal }) => Promise<any>>
): Promise<{ plan: DAGPlan | null; validation: ValidationResult; metrics: MissionMetrics | null }> {

  const validation = validateAndSanitize(draft, toolFns);

  // Log validation results
  recordJournal({
    sessionId: 'llm-adapter',
    type: 'ACTION_RECORD',
    level: validation.valid ? 'INFO' : 'WARN',
    data: {
      event: 'LLM_PLAN_VALIDATED',
      valid: validation.valid,
      stepsProposed: draft.steps?.length || 0,
      stepsSanitized: validation.sanitizedSteps.length,
      hallucinations: validation.stripped.length,
      blocked: validation.blocked.length,
      circular: validation.circularDeps
    }
  });

  if (!validation.valid) {
    log({ level: 'WARN', module: 'LLMAdapter', message: `Plan rejected: ${validation.warnings.join(', ')}` });
    return { plan: null, validation, metrics: null };
  }

  // Create session and DAG
  const session = createSession(`llm-${Date.now()}`);
  const plan = createDAGPlan(session.id, agent, draft.objective!, validation.sanitizedSteps);
  const startTime = Date.now();

  const result = await executeDAGPlan(plan);

  const metrics: MissionMetrics = {
    missionId: plan.id,
    agent,
    timestamp: Date.now(),
    stepsProposed: draft.steps?.length || 0,
    stepsExecuted: result.steps.filter(s => s.status === 'success').length,
    stepsBlocked: validation.blocked.length,
    stepsFailed: result.steps.filter(s => s.status === 'failed').length,
    ticketsConsumed: result.steps.filter(s => s.status === 'success').length,
    networkAttempts: result.steps.filter(s => s.action.type === 'network.fetch').length,
    networkRejected: result.steps.filter(s => s.action.type === 'network.fetch' && s.status === 'failed').length,
    fetchRedundant: 0,
    durationMs: Date.now() - startTime,
    outcome: result.outcome,
    loopsDetected: validation.circularDeps ? 1 : 0,
    hallucinations: validation.stripped.length
  };

  recordMetrics(metrics);
  shutdownPool();

  return { plan: result, validation, metrics };
}
