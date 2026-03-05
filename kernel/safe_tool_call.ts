import { inspect } from './supervisor';
import { log, recordMetric, metrics } from './logger';
import { evaluateRisk } from './risk_engine';
import { consumeBudget } from './budget_engine';
import { updateSessionState, getSession } from './process_manager';
import { recordJournal } from './journal';

export async function safeToolCall(processProfile: Record<string, boolean>, action: any) {
  const sessionId = action.context?.sessionId;
  const session = sessionId ? getSession(sessionId) : null;

  if (sessionId) updateSessionState(sessionId, 'EXECUTING');

  // PHYSICAL CHECK: Is session aborted?
  if (session?.abortController.signal.aborted) {
    throw new Error(`Execution ABORTED: ${session.abortController.signal.reason}`);
  }

  // 1. BudgetEngine
  if (sessionId) {
    const budget = consumeBudget(sessionId);
    if (!budget.allowed) throw new Error(`Budget Rejection: ${budget.reason}`);
  }

  // 2. Risk & Supervisor
  const risk = evaluateRisk(action);
  const decision = inspect({ type: action.type, details: action.details, permissionProfile: processProfile });

  recordJournal({
    sessionId: sessionId || 'system',
    type: 'ACTION_RECORD',
    level: decision.allow ? 'INFO' : 'WARN',
    data: { actionType: action.type, risk: risk.level, allowed: decision.allow, rule: decision.rule }
  });

  if (!risk.isMalformed && risk.score < 1.0 && decision.allow) {
    try {
      // Pass the signal to the internal function if supported
      const result = await action.fn({ signal: session?.abortController.signal });
      if (sessionId) updateSessionState(sessionId, 'IDLE');
      return result;
    } catch (e) {
      if (sessionId) updateSessionState(sessionId, 'FAILED');
      throw e;
    }
  } else {
    if (sessionId) updateSessionState(sessionId, 'BLOCKED');
    throw new Error(`Blocked by RiskEngine or Supervisor`);
  }
}
