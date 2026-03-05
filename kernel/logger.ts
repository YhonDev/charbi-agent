// charbi/kernel/logger.ts
import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

export type LogEntry = {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  sessionId?: string;
  module: string;
  message: string;
  data?: any;
};

/**
 * Structured Logger
 * Saves logs as newline-delimited JSON for easy analysis.
 */
export function log(entry: Omit<LogEntry, 'timestamp'>) {
  const fullEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  };

  const logFile = path.join(LOG_DIR, `kernel-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, JSON.stringify(fullEntry) + '\n');

  // Console output with colors (simulated)
  const color = entry.level === 'SECURITY' ? '\x1b[31m' : entry.level === 'WARN' ? '\x1b[33m' : '\x1b[32m';
  console.log(`${color}[${fullEntry.timestamp}] [${entry.level}] [${entry.module}] ${entry.message}\x1b[0m`);
}

/**
 * Metrics Tracker
 */
export const metrics = {
  toolCalls: 0,
  blocks: 0,
  escalations: 0,
  sessions: 0
};

export function recordMetric(type: keyof typeof metrics) {
  metrics[type]++;
}
