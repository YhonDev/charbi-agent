// charbi/kernel/lock_manager.ts
import { log } from './logger';
import { recordJournal } from './journal';

export type LockType = 'READ' | 'WRITE';

export interface ResourceLock {
  resource: string;
  type: LockType;
  holder: string;     // sessionId or stepId
  acquiredAt: number;
}

const activeLocks: Map<string, ResourceLock[]> = new Map();

/**
 * acquireLock
 * Attempts to acquire a lock on a resource.
 * - Multiple READ locks are allowed simultaneously.
 * - WRITE lock requires exclusive access (no other locks).
 * - Returns false if the lock cannot be acquired (caller must wait or abort).
 */
export function acquireLock(resource: string, type: LockType, holder: string): boolean {
  const existing = activeLocks.get(resource) || [];

  if (type === 'WRITE') {
    // WRITE requires NO existing locks of any kind
    if (existing.length > 0) {
      log({ level: 'WARN', module: 'LockManager', message: `WRITE lock denied on '${resource}' — held by ${existing.map(l => l.holder).join(', ')}` });
      return false;
    }
  }

  if (type === 'READ') {
    // READ is blocked only if a WRITE lock exists
    const writeHeld = existing.some(l => l.type === 'WRITE');
    if (writeHeld) {
      log({ level: 'WARN', module: 'LockManager', message: `READ lock denied on '${resource}' — WRITE lock held by ${existing[0].holder}` });
      return false;
    }
  }

  const lock: ResourceLock = { resource, type, holder, acquiredAt: Date.now() };
  existing.push(lock);
  activeLocks.set(resource, existing);

  log({ level: 'INFO', module: 'LockManager', message: `${type} lock acquired on '${resource}' by ${holder}` });
  return true;
}

/**
 * releaseLock
 * Releases a specific holder's lock on a resource.
 */
export function releaseLock(resource: string, holder: string): void {
  const existing = activeLocks.get(resource);
  if (!existing) return;

  const filtered = existing.filter(l => l.holder !== holder);
  if (filtered.length === 0) {
    activeLocks.delete(resource);
  } else {
    activeLocks.set(resource, filtered);
  }

  log({ level: 'INFO', module: 'LockManager', message: `Lock released on '${resource}' by ${holder}` });
}

/**
 * releaseAllLocks
 * Releases all locks held by a specific holder (cleanup on session end).
 */
export function releaseAllLocks(holder: string): void {
  for (const [resource, locks] of activeLocks.entries()) {
    const filtered = locks.filter(l => l.holder !== holder);
    if (filtered.length === 0) {
      activeLocks.delete(resource);
    } else {
      activeLocks.set(resource, filtered);
    }
  }
}

/**
 * isLocked
 * Checks if a resource has any active locks.
 */
export function isLocked(resource: string): { locked: boolean; type?: LockType; holders?: string[] } {
  const existing = activeLocks.get(resource);
  if (!existing || existing.length === 0) return { locked: false };
  return {
    locked: true,
    type: existing.some(l => l.type === 'WRITE') ? 'WRITE' : 'READ',
    holders: existing.map(l => l.holder)
  };
}

/**
 * getLocksForHolder
 * Returns all resources locked by a specific holder.
 */
export function getLocksForHolder(holder: string): ResourceLock[] {
  const result: ResourceLock[] = [];
  for (const locks of activeLocks.values()) {
    result.push(...locks.filter(l => l.holder === holder));
  }
  return result;
}
