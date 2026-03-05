// charbi/kernel/budget_engine.ts
import { log } from './logger';
import { loadConfig } from './config_loader';
import { recordJournal } from './journal';

export interface SessionBudget {
  actionsRemaining: number;
  timeLimit: number;
  startTime: number;
}

const activeBudgets: Map<string, SessionBudget> = new Map();

export function initializeBudget(sessionId: string) {
  const config = loadConfig();
  activeBudgets.set(sessionId, {
    actionsRemaining: config.supervisor.max_tool_calls || 20,
    timeLimit: 30000,
    startTime: Date.now()
  });
}

/**
 * consumeBudget
 * Checks if the action is within the allowed budget for the session.
 */
export function consumeBudget(sessionId: string): { allowed: boolean; reason?: string } {
  const budget = activeBudgets.get(sessionId);
  if (!budget) return { allowed: true }; // System tasks might not have budgets

  budget.actionsRemaining--;

  if (budget.actionsRemaining < 0) return { allowed: false, reason: 'Action budget exhausted' };

  const elapsed = Date.now() - budget.startTime;
  if (elapsed > budget.timeLimit) return { allowed: false, reason: 'Time budget exhausted' };

  recordJournal({
    sessionId,
    type: 'BUDGET_CONSUMPTION',
    level: 'INFO',
    data: { actionsRemaining: budget.actionsRemaining, elapsed }
  });

  return { allowed: true };
}
