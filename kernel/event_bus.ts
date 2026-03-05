// charbi/kernel/event_bus.ts
import { EventEmitter } from 'events';

/**
 * Charbi Kernel Event Bus
 * Centralized pub/sub system for all kernel events.
 */
export const eventBus = new EventEmitter();

export type KernelEvent = {
  id: string;
  type: string;
  timestamp: number;
  origin?: string;
  payload?: any;
};

import { log } from './logger';

export function emitEvent(e: KernelEvent) {
  eventBus.emit(e.type, e);
  log({
    level: 'INFO',
    module: 'EventBus',
    message: `Emitted event: ${e.type}`,
    sessionId: e.id,
    data: { type: e.type, origin: e.origin }
  });
}

export default eventBus;
