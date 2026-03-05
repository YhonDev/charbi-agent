// charbi/kernel/metrics.ts
import fs from 'fs';
import path from 'path';
import { log } from './logger';

const METRICS_DIR = path.join(process.cwd(), 'metrics');
if (!fs.existsSync(METRICS_DIR)) fs.mkdirSync(METRICS_DIR, { recursive: true });

const METRICS_FILE = path.join(METRICS_DIR, 'runtime_metrics.jsonl');

export interface MissionMetrics {
  missionId: string;
  agent: string;
  timestamp: number;
  stepsProposed: number;
  stepsExecuted: number;
  stepsBlocked: number;
  stepsFailed: number;
  ticketsConsumed: number;
  networkAttempts: number;
  networkRejected: number;
  fetchRedundant: number;
  durationMs: number;
  outcome: string;
  loopsDetected: number;
  hallucinations: number;
}

const sessionMetrics: MissionMetrics[] = [];

export function recordMetrics(m: MissionMetrics): void {
  sessionMetrics.push(m);
  fs.appendFileSync(METRICS_FILE, JSON.stringify(m) + '\n');
  log({ level: 'INFO', module: 'Metrics', message: `Mission ${m.missionId}: ${m.stepsExecuted}/${m.stepsProposed} steps, ${m.stepsBlocked} blocked, ${m.hallucinations} stripped` });
}

export function getSessionMetrics(): MissionMetrics[] {
  return [...sessionMetrics];
}

export function getAggregateMetrics(): {
  totalMissions: number;
  avgSteps: number;
  avgDuration: number;
  totalBlocked: number;
  totalNetworkRejected: number;
  totalHallucinations: number;
  blockRate: number;
} {
  if (sessionMetrics.length === 0) return { totalMissions: 0, avgSteps: 0, avgDuration: 0, totalBlocked: 0, totalNetworkRejected: 0, totalHallucinations: 0, blockRate: 0 };

  const total = sessionMetrics.length;
  const avgSteps = sessionMetrics.reduce((s, m) => s + m.stepsProposed, 0) / total;
  const avgDuration = sessionMetrics.reduce((s, m) => s + m.durationMs, 0) / total;
  const totalBlocked = sessionMetrics.reduce((s, m) => s + m.stepsBlocked, 0);
  const totalNetworkRejected = sessionMetrics.reduce((s, m) => s + m.networkRejected, 0);
  const totalHallucinations = sessionMetrics.reduce((s, m) => s + m.hallucinations, 0);
  const totalProposed = sessionMetrics.reduce((s, m) => s + m.stepsProposed, 0);
  const blockRate = totalProposed > 0 ? totalBlocked / totalProposed : 0;

  return { totalMissions: total, avgSteps, avgDuration, totalBlocked, totalNetworkRejected, totalHallucinations, blockRate };
}
