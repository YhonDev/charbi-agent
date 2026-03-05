// charbi/kernel/journal.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const JOURNAL_DIR = path.join(process.cwd(), 'logs', 'journals');
if (!fs.existsSync(JOURNAL_DIR)) fs.mkdirSync(JOURNAL_DIR, { recursive: true });

export interface JournalEntry {
  timestamp: number;
  sessionId: string;
  type: 'STATE_CHANGE' | 'ACTION_RECORD' | 'BUDGET_CONSUMPTION' | 'SECURITY_INCIDENT';
  level: 'INFO' | 'WARN' | 'ERROR';
  data: any;
  hash?: string;
}

const sessionHashes: Map<string, string> = new Map();

/**
 * Journal System with Hash Chaining
 * Provides a high-fidelity audit trail for every session.
 */
export function recordJournal(entry: Omit<JournalEntry, 'timestamp'>) {
  const timestamp = Date.now();
  const prevHash = sessionHashes.get(entry.sessionId) || 'root';

  const entryString = JSON.stringify({ ...entry, timestamp, prevHash });
  const hash = crypto.createHash('sha256').update(entryString).digest('hex');

  const fullEntry: JournalEntry = {
    timestamp,
    ...entry,
    hash
  };

  sessionHashes.set(entry.sessionId, hash);

  const journalFile = path.join(JOURNAL_DIR, `session-${entry.sessionId}.jsonl`);
  fs.appendFileSync(journalFile, JSON.stringify(fullEntry) + '\n');
}

/**
 * readJournal
 * Retrieves the journal for a specific session.
 */
export function readJournal(sessionId: string): JournalEntry[] {
  const journalFile = path.join(JOURNAL_DIR, `session-${sessionId}.jsonl`);
  if (!fs.existsSync(journalFile)) return [];

  return fs.readFileSync(journalFile, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}
