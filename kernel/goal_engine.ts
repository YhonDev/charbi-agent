// charbi/kernel/goal_engine.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { log } from './logger';
import { recordJournal, readJournal } from './journal';

const GOALS_DIR = path.join(process.cwd(), 'goals');
if (!fs.existsSync(GOALS_DIR)) fs.mkdirSync(GOALS_DIR, { recursive: true });

const REGISTRY_FILE = path.join(GOALS_DIR, 'registry.json');
const SCHEMA_VERSION = 1;

export type GoalStatus = 'pending' | 'running' | 'blocked' | 'completed' | 'failed' | 'abandoned';

export interface GoalCheckpoint {
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  timestamp: number;
}

export interface Goal {
  id: string;
  schemaVersion: number;
  objective: string;
  agent: string;
  status: GoalStatus;
  priority: number;               // 1=highest, 10=lowest
  checkpoints: GoalCheckpoint[];  // Progress tracking
  lastStepId: string | null;      // Last successfully completed step
  dependencies: string[];         // Other goal IDs that must complete first
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  metadata: Record<string, any>;  // Extensible context
  hash: string;                   // Integrity verification
}

interface GoalRegistry {
  schemaVersion: number;
  goals: Goal[];
  lastModified: number;
}

function computeHash(goal: Omit<Goal, 'hash'>): string {
  return crypto.createHash('sha256').update(JSON.stringify(goal)).digest('hex');
}

function loadRegistry(): GoalRegistry {
  if (!fs.existsSync(REGISTRY_FILE)) {
    return { schemaVersion: SCHEMA_VERSION, goals: [], lastModified: Date.now() };
  }
  const raw = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));

  // Schema migration check
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    log({ level: 'WARN', module: 'GoalEngine', message: `Registry schema mismatch: expected v${SCHEMA_VERSION}, got v${raw.schemaVersion}. Migration needed.` });
    return migrateRegistry(raw);
  }
  return raw;
}

function saveRegistry(registry: GoalRegistry): void {
  registry.lastModified = Date.now();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

function migrateRegistry(old: any): GoalRegistry {
  // Future migration logic goes here
  log({ level: 'INFO', module: 'GoalEngine', message: `Migrated registry to v${SCHEMA_VERSION}` });
  return { ...old, schemaVersion: SCHEMA_VERSION };
}

// ─── PUBLIC API ───

/**
 * registerGoal
 * Creates a new persistent goal in the registry.
 */
export function registerGoal(params: {
  objective: string;
  agent: string;
  priority?: number;
  dependencies?: string[];
  metadata?: Record<string, any>;
}): Goal {
  const registry = loadRegistry();

  const partial = {
    id: `goal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    schemaVersion: SCHEMA_VERSION,
    objective: params.objective,
    agent: params.agent,
    status: 'pending' as GoalStatus,
    priority: params.priority || 5,
    checkpoints: [],
    lastStepId: null,
    dependencies: params.dependencies || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: params.metadata || {}
  };

  const goal: Goal = { ...partial, hash: computeHash(partial) };

  registry.goals.push(goal);
  saveRegistry(registry);

  log({ level: 'INFO', module: 'GoalEngine', message: `Goal registered: "${params.objective}" [${goal.id}]` });
  return goal;
}

/**
 * updateGoalStatus
 * Transitions a goal's status with integrity verification.
 */
export function updateGoalStatus(goalId: string, status: GoalStatus, checkpoint?: GoalCheckpoint): Goal | null {
  const registry = loadRegistry();
  const goal = registry.goals.find(g => g.id === goalId);
  if (!goal) return null;

  goal.status = status;
  goal.updatedAt = Date.now();
  if (status === 'completed' || status === 'failed') goal.completedAt = Date.now();
  if (checkpoint) {
    goal.checkpoints.push(checkpoint);
    goal.lastStepId = checkpoint.stepId;
  }

  // Recompute hash
  const { hash: _, ...rest } = goal;
  goal.hash = computeHash(rest);

  saveRegistry(registry);
  return goal;
}

/**
 * getPendingGoals
 * Returns goals that can be executed (pending + dependencies met).
 */
export function getPendingGoals(): Goal[] {
  const registry = loadRegistry();
  return registry.goals
    .filter(g => g.status === 'pending' || g.status === 'blocked')
    .filter(g => {
      // Check if all dependencies are completed
      return g.dependencies.every(depId => {
        const dep = registry.goals.find(d => d.id === depId);
        return dep && dep.status === 'completed';
      });
    })
    .sort((a, b) => a.priority - b.priority);
}

/**
 * getGoal
 * Retrieves a specific goal by ID.
 */
export function getGoal(goalId: string): Goal | null {
  const registry = loadRegistry();
  return registry.goals.find(g => g.id === goalId) || null;
}

/**
 * getAllGoals
 * Returns all goals in the registry.
 */
export function getAllGoals(): Goal[] {
  return loadRegistry().goals;
}

/**
 * rehydrate
 * Validates the runtime state on startup and identifies goals to resume.
 * Returns a list of goals that can be safely resumed.
 */
export function rehydrate(): { resumable: Goal[]; corrupted: string[]; report: string } {
  const registry = loadRegistry();
  const resumable: Goal[] = [];
  const corrupted: string[] = [];

  for (const goal of registry.goals) {
    // Verify hash integrity
    const { hash: stored, ...rest } = goal;
    const computed = computeHash(rest);

    if (stored !== computed) {
      corrupted.push(goal.id);
      log({ level: 'ERROR', module: 'GoalEngine', message: `INTEGRITY VIOLATION: Goal ${goal.id} hash mismatch` });

      recordJournal({
        sessionId: 'rehydration',
        type: 'SECURITY_INCIDENT',
        level: 'ERROR',
        data: { event: 'GOAL_INTEGRITY_VIOLATION', goalId: goal.id, expected: computed, found: stored }
      });
      continue;
    }

    // Running goals that were interrupted → need resume
    if (goal.status === 'running') {
      goal.status = 'blocked'; // Mark as blocked until explicitly resumed
      goal.updatedAt = Date.now();
      const { hash: _, ...r } = goal;
      goal.hash = computeHash(r);
      resumable.push(goal);
    }

    // Pending goals with met dependencies
    if (goal.status === 'pending') {
      const depsOk = goal.dependencies.every(depId => {
        const dep = registry.goals.find(d => d.id === depId);
        return dep && dep.status === 'completed';
      });
      if (depsOk) resumable.push(goal);
    }
  }

  saveRegistry(registry);

  const report = [
    `=== Rehydration Report ===`,
    `Total goals: ${registry.goals.length}`,
    `Resumable: ${resumable.length}`,
    `Corrupted: ${corrupted.length}`,
    `Schema: v${SCHEMA_VERSION}`
  ].join('\n');

  log({ level: 'INFO', module: 'GoalEngine', message: `Rehydration: ${resumable.length} resumable, ${corrupted.length} corrupted` });

  return { resumable, corrupted, report };
}
