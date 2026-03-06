/**
 * 🧪 TaskGraph Test Helpers
 * Utilidades para debugging rápido y tests más limpios
 */

import { EventEmitter } from 'events';

export interface TestEvent {
  type: string;
  payload: any;
  correlationId: string;
  timestamp: number;
}

export class TaskGraphTestHelper {
  private eventLog: TestEvent[] = [];
  private realEmitter: EventEmitter;
  private startTime: number;

  constructor() {
    this.realEmitter = new EventEmitter();
    this.startTime = Date.now();
    this.setupEventLogging();
  }

  /**
   * ✅ Configura logging automático de eventos
   */
  private setupEventLogging(): void {
    const criticalEvents = [
      'user.request',
      'task.created',
      'task.started',
      'task.completed',
      'task.failed',
      'tool.called',
      'tool.result',
      'agent.response',
      'agent.status',
      'system.ready'
    ];

    for (const eventType of criticalEvents) {
      this.realEmitter.on(eventType, (event: any) => {
        this.logEvent(eventType, event);
      });
    }
  }

  /**
   * ✅ Loguea evento con timestamp relativo
   */
  private logEvent(eventType: string, event: any): void {
    // Si es un KernelEvent, el payload está en .payload
    const payload = event.payload || event;
    const corrId = event.correlationId || payload.correlationId || 'unknown';

    const entry: TestEvent = {
      type: eventType,
      payload: payload,
      correlationId: corrId,
      timestamp: Date.now() - this.startTime,
    };

    this.eventLog.push(entry);

    // Console log formateado para debugging
    console.log(
      `[EVENT ${entry.timestamp.toString().padStart(5, '0')}ms]`,
      eventType.padEnd(20, ' '),
      `| CorrID: ${corrId.substring(0, 8)}`,
      `| ${JSON.stringify(payload).substring(0, 100)}`
    );
  }

  /**
   * ✅ Obtiene todos los eventos de un correlationId
   */
  getFlow(correlationId: string): TestEvent[] {
    return this.eventLog.filter(e => e.correlationId === correlationId);
  }

  /**
   * ✅ Imprime flujo completo de eventos
   */
  printFlow(correlationId: string): void {
    const flow = this.getFlow(correlationId);

    console.log('\n' + '='.repeat(80));
    console.log(`TASKGRAPH FLOW: ${correlationId}`);
    console.log('='.repeat(80));

    if (flow.length === 0) {
      console.log('❌ NO EVENTS FOUND');
    } else {
      let lastTimestamp = 0;
      for (const entry of flow) {
        const delta = entry.timestamp - lastTimestamp;
        const icon = this.getEventIcon(entry.type);
        console.log(
          `[${entry.timestamp.toString().padStart(5, '0')}ms]`,
          `[+${delta.toString().padStart(4, '0')}ms]`,
          icon,
          entry.type.padEnd(20, ' ')
        );
        lastTimestamp = entry.timestamp;
      }
    }

    console.log('='.repeat(80));
    console.log(`Total Events: ${flow.length}`);
    console.log(`Total Time: ${flow[flow.length - 1]?.timestamp || 0}ms`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * ✅ Obtiene ícono por tipo de evento
   */
  private getEventIcon(eventType: string): string {
    const icons: Record<string, string> = {
      'user.request': '📩',
      'task.created': '✅',
      'task.started': '▶️',
      'task.completed': '✓',
      'task.failed': '✗',
      'tool.called': '🔧',
      'tool.result': '📤',
      'agent.response': '🎉',
      'agent.status': '💡',
    };
    return icons[eventType] || '•';
  }

  /**
   * ✅ Verifica que un evento ocurrió
   */
  assertEventOccurred(eventType: string, correlationId?: string): void {
    const events = correlationId
      ? this.eventLog.filter(e => e.type === eventType && e.correlationId === correlationId)
      : this.eventLog.filter(e => e.type === eventType);

    if (events.length === 0) {
      throw new Error(
        `Expected event ${eventType} to occur${correlationId ? ` for ${correlationId}` : ''}, but it didn't.\n` +
        `Events that DID occur: ${this.eventLog.map(e => e.type).join(', ')}`
      );
    }
  }

  /**
   * ✅ Verifica orden de eventos
   */
  assertEventOrder(expectedOrder: string[], correlationId?: string): void {
    const flow = correlationId ? this.getFlow(correlationId) : this.eventLog;
    const actualOrder = flow.map(e => e.type);

    for (const expected of expectedOrder) {
      const index = actualOrder.indexOf(expected);
      if (index === -1) {
        throw new Error(
          `Expected event ${expected} in flow, but it didn't occur.\n` +
          `Actual flow: ${actualOrder.join(' → ')}`
        );
      }
    }
  }

  /**
   * ✅ Obtiene tiempo entre dos eventos
   */
  getEventDuration(startEvent: string, endEvent: string, correlationId?: string): number {
    const flow = correlationId ? this.getFlow(correlationId) : this.eventLog;
    const start = flow.find(e => e.type === startEvent);
    const end = flow.find(e => e.type === endEvent);

    if (!start || !end) {
      return -1;
    }

    return end.timestamp - start.timestamp;
  }

  /**
   * ✅ Resetear logs para siguiente test
   */
  reset(): void {
    this.eventLog = [];
    this.realEmitter.removeAllListeners();
    this.startTime = Date.now();
    this.setupEventLogging();
  }

  /**
   * ✅ Obtiene emitter para mocks
   */
  getEmitter(): EventEmitter {
    return this.realEmitter;
  }

  /**
   * ✅ Crea mock de EventBus con logging
   */
  createMockEventBus(): any {
    return {
      on: jest.fn((event: string, handler: Function) =>
        this.realEmitter.on(event, handler as any)
      ),
      emit: jest.fn((event: string, data: any) => {
        this.logEvent(event, data);
        return this.realEmitter.emit(event, data);
      }),
      removeAllListeners: jest.fn(() => this.realEmitter.removeAllListeners()),
      once: jest.fn((event: string, handler: Function) =>
        this.realEmitter.once(event, handler as any)
      ),
      listenerCount: jest.fn((event: string) => this.realEmitter.listenerCount(event)),
    };
  }
}

/**
 * ✅ Factory para crear tareas de test
 */
export function createTestTask(overrides: Partial<any> = {}): any {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    description: 'Test task description',
    tool: 'system.write',
    toolArgs: { path: '/tmp/test.txt', content: 'test' },
    status: 'pending',
    dependencies: [],
    retryCount: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * ✅ Factory para crear TaskGraph de test
 */
export function createTestTaskGraph(overrides: Partial<any> = {}): any {
  return {
    id: `tg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    objective: 'Test objective',
    tasks: [createTestTask()],
    status: 'planning',
    createdAt: Date.now(),
    currentTaskIndex: 0,
    correlationId: `test_${Date.now()}`,
    metadata: {
      complexityScore: 50,
      complexityReasons: ['Test reason'],
      estimatedTasks: 1,
      actualTasks: 1,
      chatId: 'chat-1',
      origin: 'web'
    },
    ...overrides,
  };
}

/**
 * ✅ Espera asíncrona con timeout y logging
 */
export async function waitForCondition(
  condition: () => boolean,
  timeoutMs: number = 5000,
  description: string = 'condition'
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Timeout waiting for ${description} after ${timeoutMs}ms.\n` +
        `Condition still false after ${Date.now() - startTime}ms`
      );
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`✅ ${description} completed in ${Date.now() - startTime}ms`);
}
