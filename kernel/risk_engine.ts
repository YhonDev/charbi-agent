// charbi/kernel/risk_engine.ts
import { KernelAction, RiskLevel } from './types';
import { log } from './logger';

export interface RiskAnalysis {
  isMalformed: boolean;
  level: RiskLevel;
  score: number; // 0 to 1
  reason?: string;
}

/**
 * RiskEngine
 * Evaluates the structural integrity and risk category of an action.
 */
export function evaluateRisk(action: any): RiskAnalysis {
  // 1. Structure Check
  if (!action || typeof action.type !== 'string' || !action.details || !action.context) {
    return { isMalformed: true, level: 'CRITICAL', score: 1.0, reason: 'Missing type, details or context' };
  }

  // 2. Type Whitelist
  const validTypes = ['filesystem.read', 'filesystem.write', 'shell.execute', 'network.access', 'network.fetch'];
  if (!validTypes.includes(action.type)) {
    return { isMalformed: true, level: 'CRITICAL', score: 1.0, reason: `Unknown action type: ${action.type}` };
  }

  // 3. Category Intelligence
  let level: RiskLevel = 'LOW';
  let score = 0.1;

  switch (action.type) {
    case 'filesystem.read':
    case 'filesystem.write':
      level = action.type === 'filesystem.read' ? 'LOW' : 'MEDIUM';
      score = action.type === 'filesystem.read' ? 0.2 : 0.5;

      const path = action.details.path || '';
      if (path.includes('..') || path.startsWith('/') || path.includes(':')) {
        level = 'CRITICAL';
        score = 1.0;
        return { isMalformed: false, level, score, reason: 'Traversal or absolute path detected' };
      }

      if (path.includes('kernel') || path.includes('config')) {
        level = 'HIGH';
        score = 0.9;
      }
      break;
    case 'shell.execute':
      level = 'HIGH';
      score = 0.8;
      const cmd = action.details.command || '';
      if (cmd.includes('rm') || cmd.includes('sudo') || cmd.includes('> /dev/')) {
        level = 'CRITICAL';
        score = 1.0;
      }
      break;
    case 'network.access':
      level = 'CRITICAL';
      score = 0.9;
      break;
    case 'network.fetch':
      level = 'MEDIUM';
      score = 0.5;
      break;
  }

  return { isMalformed: false, level, score };
}
