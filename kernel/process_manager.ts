// charbi/kernel/process_manager.ts
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { SessionState, ActionResponse } from './types';
import { log } from './logger';
import { initializeBudget } from './budget_engine';
import { recordJournal } from './journal';

export type Session = {
  id: string;
  workspace: string;
  startTime: number;
  state: SessionState;
  timer?: NodeJS.Timeout;
  abortController: AbortController;
};

const activeSessions: Map<string, Session> = new Map();

const ALLOWED_TRANSITIONS: Record<SessionState, SessionState[]> = {
  'IDLE': ['PLANNING', 'EXECUTING', 'COMPLETED', 'FAILED'],
  'PLANNING': ['EXECUTING', 'COMPLETED', 'FAILED', 'BLOCKED'],
  'EXECUTING': ['IDLE', 'BLOCKED', 'FAILED', 'COMPLETED'],
  'BLOCKED': ['IDLE', 'FAILED', 'COMPLETED'],
  'FAILED': [],
  'COMPLETED': []
};

/**
 * transitionSession
 * Validates and records session state changes.
 */
export function updateSessionState(id: string, nextState: SessionState) {
  const session = activeSessions.get(id);
  if (!session) return;

  const current = session.state;
  if (current === nextState) return;

  if (!ALLOWED_TRANSITIONS[current].includes(nextState)) {
    log({ level: 'WARN', module: 'ProcessManager', message: `Invalid transition: ${current} -> ${nextState}`, sessionId: id });
    return;
  }

  session.state = nextState;
  recordJournal({
    sessionId: id,
    type: 'STATE_CHANGE',
    level: 'INFO',
    data: { from: current, to: nextState }
  });
}

/**
 * createSession
 * Creates an isolated environment and initializes states/budgets.
 */
export function createSession(id: string): Session {
  const workspace = path.join(process.cwd(), 'runtime', 'sessions', id);
  if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });

  const session: Session = {
    id,
    workspace,
    startTime: Date.now(),
    state: 'IDLE',
    abortController: new AbortController()
  };

  initializeBudget(id);

  // Security Timeout (Interrupt mechanism)
  session.timer = setTimeout(() => {
    killSession(id, 'EXECUTION_TIMEOUT');
  }, 60000); // 1 min hard limit

  activeSessions.set(id, session);
  return session;
}

/**
 * killSession
 * Forcefully terminates a session execution.
 */
export function killSession(id: string, reason: string) {
  const session = activeSessions.get(id);
  if (session) {
    session.abortController.abort(reason);
    if (session.timer) clearTimeout(session.timer);

    updateSessionState(id, 'FAILED');
    log({ level: 'WARN', module: 'ProcessManager', message: `Physical Interrupt: ${reason}`, sessionId: id });
    activeSessions.delete(id);
    // In a real OS, we would kill the child process here.
  }
}

export function getSession(id: string): Session | undefined {
  return activeSessions.get(id);
}

/**
 * runInSession
 * Executes a command within the isolated workspace of a session.
 * Respects the AbortSignal physically.
 */
export function runInSession(session: Session, cmd: string, opts = {}) {
  log({ level: 'INFO', module: 'ProcessManager', message: `Running command: ${cmd}`, sessionId: session.id });

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const process = exec(cmd, {
      cwd: session.workspace,
      signal: session.abortController.signal,
      ...opts
    }, (err, stdout, stderr) => {
      if (err) {
        if (err.name === 'AbortError') {
          log({ level: 'WARN', module: 'ProcessManager', message: `Command ABORTED physically: ${cmd}`, sessionId: session.id });
        }
        return reject({ err, stdout, stderr });
      }
      resolve({ stdout, stderr });
    });
  });
}
