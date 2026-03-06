/**
 * 🧪 TaskGraphEngine - Debug Tests
 * Tests diseñados para flujo de eventos y problemas de colgado
 */

import { TaskGraphTestHelper } from './helpers/task-graph-test-helpers';

// ✅ Mock de EventBus CON LOGGING (Auto-contenido)
jest.mock('../../../kernel/event_bus', () => {
  const Emitter = require('events').EventEmitter;
  const internalEmitter = new Emitter();

  // @ts-ignore
  global.mockInternalEmitterDebug = internalEmitter;

  const mockEvBus = {
    on: jest.fn((event, handler) => internalEmitter.on(event, handler)),
    emit: jest.fn((event, data) => {
      internalEmitter.emit(event, data);
    }),
    removeAllListeners: jest.fn(() => internalEmitter.removeAllListeners()),
    once: jest.fn((event, handler) => internalEmitter.once(event, handler)),
    listenerCount: jest.fn((event) => internalEmitter.listenerCount(event)),
  };

  const mockTypes = {
    USER_REQUEST: 'user.request',
    TASK_CREATED: 'task.created',
    TASK_STARTED: 'task.started',
    TASK_COMPLETED: 'task.completed',
    TASK_FAILED: 'task.failed',
    TOOL_CALLED: 'tool.called',
    TOOL_RESULT: 'tool.result',
    AGENT_RESPONSE: 'agent.response'
  };

  return {
    eventBus: mockEvBus,
    EventType: mockTypes,
    emitEvent: jest.fn((e) => {
      internalEmitter.emit(e.type, e);
    }),
    default: mockEvBus
  };
});

jest.mock('../../../kernel/cognition/intelligence_proxy', () => ({
  IntelligenceProxy: {
    getInstance: jest.fn(() => ({
      generate: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          tasks: [
            {
              id: 'debug_task_1',
              description: 'Step 1',
              tool: 'system.write',
              dependencies: [],
            },
          ],
        }),
        toolCalls: [],
      }),
    })),
  },
}));

// Mock de ToolRegistry
jest.mock('../../../kernel/tool_registry', () => ({
  toolRegistry: {
    getTool: jest.fn((name) => ({
      schema: { name, description: 'mock tool' },
      handler: jest.fn().mockResolvedValue({ success: true, data: {} })
    })),
    getAllSchemas: jest.fn(() => []),
    listNames: jest.fn(() => [])
  }
}));

// @ts-ignore
import { TaskGraphEngine } from '../../../kernel/task_graph/task_graph_engine';

describe('TaskGraph Debug', () => {
  let taskGraphEngine: TaskGraphEngine;
  let mockTestHelper: TaskGraphTestHelper;

  beforeEach(() => {
    // @ts-ignore
    const emitter = global.mockInternalEmitterDebug;
    mockTestHelper = new TaskGraphTestHelper();
    // @ts-ignore
    mockTestHelper.realEmitter = emitter;

    emitter.removeAllListeners();
    mockTestHelper.reset();

    // @ts-ignore
    TaskGraphEngine.instance = undefined;
    taskGraphEngine = TaskGraphEngine.getInstance();
  });

  it('DEBUG: Should show complete event flow', async () => {
    const correlationId = 'debug_test_123';

    console.log('\n🔍 DEBUG TEST: Complete Event Flow\n');

    const graph = await taskGraphEngine.create('Debug task', correlationId, 'chat-debug', 'web');
    const task = taskGraphEngine.getNextTask(graph.id);

    taskGraphEngine.completeTask(graph.id, task!.id, { success: true });

    // Imprimir flujo
    mockTestHelper.printFlow(correlationId);

    expect(graph).toBeDefined();
  });

  it('DEBUG: Should show all registered event handlers', () => {
    console.log('\n🔍 DEBUG TEST: Event Handler Registration\n');

    // @ts-ignore
    const emitter = global.mockInternalEmitterDebug;

    const eventTypes = [
      'task.completed',
      'task.failed',
      'tool.result',
    ];

    for (const eventType of eventTypes) {
      const listenerCount = emitter.listenerCount(eventType);
      console.log(`  ${eventType}: ${listenerCount} listener(s)`);
      expect(listenerCount).toBeGreaterThan(0);
    }
  });
});
