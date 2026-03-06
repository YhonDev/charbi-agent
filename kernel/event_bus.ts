// charbi/kernel/event_bus.ts
import { EventEmitter } from 'events';

/**
 * Charbi Kernel Event Bus
 * Centralized pub/sub system for all kernel events.
 */
export const eventBus = new EventEmitter();

/** 
 * Tipos de Eventos Estándar (Grado 3)
 */
export enum EventType {
  USER_REQUEST = 'user.request',
  AGENT_THINK = 'agent.think',
  TASK_CREATED = 'task.created',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TOOL_CALLED = 'tool.called',
  TOOL_RESULT = 'tool.result',
  AGENT_RESPONSE = 'agent.response',
  AGENT_STATUS = 'agent.status',
  SYSTEM_READY = 'system.ready'
}

export type KernelEvent = {
  id: string;
  type: EventType | string;
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
