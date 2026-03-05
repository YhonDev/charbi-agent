// charbi/kernel/memory_engine.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { log } from './logger';
import { recordJournal } from './journal';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });

export type MemoryType = 'episodic' | 'semantic' | 'policy-derived' | 'risk-log';

export const MEMORY_SCHEMA_VERSION = 1;

export interface MemoryEntry {
  id: string;
  schemaVersion?: number;
  type: MemoryType;
  sessionId: string;
  agent: string;
  content: any;
  tags: string[];
  createdAt: number;
  hash: string;
}

export interface MemoryQuery {
  type?: MemoryType;
  filter?: Record<string, any>;
  tags?: string[];
  limit?: number;
}

// Constraints: max entry size, forbidden content patterns
const MAX_ENTRY_SIZE = 10000; // 10KB
const FORBIDDEN_PATTERNS = ['../', '/etc/', 'credentials', 'password', 'token'];

function getStore(type: MemoryType): string {
  return path.join(MEMORY_DIR, `${type}.jsonl`);
}

/**
 * validateMemoryEntry
 * Enforces memory constraints before writing.
 */
function validateEntry(entry: Omit<MemoryEntry, 'id' | 'hash' | 'createdAt'>): { valid: boolean; reason?: string } {
  const serialized = JSON.stringify(entry.content);

  if (serialized.length > MAX_ENTRY_SIZE) {
    return { valid: false, reason: `Entry exceeds max size (${serialized.length}/${MAX_ENTRY_SIZE})` };
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (serialized.includes(pattern)) {
      return { valid: false, reason: `Entry contains forbidden pattern: ${pattern}` };
    }
  }

  return { valid: true };
}

/**
 * remember
 * Stores a governed memory entry.
 */
export function remember(entry: Omit<MemoryEntry, 'id' | 'hash' | 'createdAt'>): MemoryEntry | null {
  const validation = validateEntry(entry);
  if (!validation.valid) {
    log({ level: 'WARN', module: 'MemoryEngine', message: `Memory REJECTED: ${validation.reason}` });
    recordJournal({
      sessionId: entry.sessionId,
      type: 'SECURITY_INCIDENT',
      level: 'WARN',
      data: { event: 'MEMORY_REJECTED', reason: validation.reason }
    });
    return null;
  }

  const now = Date.now();
  const id = `mem-${now}-${Math.random().toString(36).substring(2, 8)}`;
  const hash = crypto.createHash('sha256').update(JSON.stringify({ ...entry, id, createdAt: now })).digest('hex');

  const full: MemoryEntry = { ...entry, id, schemaVersion: MEMORY_SCHEMA_VERSION, createdAt: now, hash };
  const store = getStore(entry.type);
  fs.appendFileSync(store, JSON.stringify(full) + '\n');

  recordJournal({
    sessionId: entry.sessionId,
    type: 'ACTION_RECORD',
    level: 'INFO',
    data: { event: 'MEMORY_STORED', memoryId: id, type: entry.type, tags: entry.tags }
  });

  return full;
}

/**
 * recall
 * Queries governed memory with filters.
 */
export function recall(query: MemoryQuery): MemoryEntry[] {
  const types: MemoryType[] = query.type ? [query.type] : ['episodic', 'semantic', 'policy-derived', 'risk-log'];
  let results: MemoryEntry[] = [];

  for (const type of types) {
    const store = getStore(type);
    if (!fs.existsSync(store)) continue;

    const entries: MemoryEntry[] = fs.readFileSync(store, 'utf8')
      .split('\n')
      .filter(l => l.trim())
      .map(l => JSON.parse(l));

    results.push(...entries);
  }

  // Apply tag filter
  if (query.tags && query.tags.length > 0) {
    results = results.filter(e => query.tags!.some(t => e.tags.includes(t)));
  }

  // Apply content filter
  if (query.filter) {
    results = results.filter(e => {
      return Object.entries(query.filter!).every(([key, value]) => {
        const content = e.content;
        return content && content[key] === value;
      });
    });
  }

  // Sort by recency
  results.sort((a, b) => b.createdAt - a.createdAt);

  return query.limit ? results.slice(0, query.limit) : results;
}
