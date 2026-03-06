/**
 * 🧪 TaskGraph Integration Tests
 * Tests de integración con EventBus, Proxy, etc.
 */

import { TaskGraphTestHelper } from './helpers/task-graph-test-helpers';

// ✅ Mock de EventBus CON LOGGING (Auto-contenido)
jest.mock('../../../kernel/event_bus', () => {
  const Emitter = require('events').EventEmitter;
  const internalEmitter = new Emitter();

  // @ts-ignore
  global.mockInternalEmitterIntegration = internalEmitter;

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
              id: 'int_task_1',
              description: 'Integration test task',
              tool: 'system.write',
              toolArgs: { path: '/tmp/integration.txt', content: 'integration' },
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

describe('TaskGraph Integration', () => {
  let taskGraphEngine: TaskGraphEngine;
  let mockTestHelper: TaskGraphTestHelper;

  beforeEach(() => {
    // @ts-ignore
    const emitter = global.mockInternalEmitterIntegration;
    mockTestHelper = new TaskGraphTestHelper();
    // @ts-ignore
    mockTestHelper.realEmitter = emitter;

    emitter.removeAllListeners();
    mockTestHelper.reset();

    // @ts-ignore
    TaskGraphEngine.instance = undefined;
    taskGraphEngine = TaskGraphEngine.getInstance();
  });

  it('should integrate with EventBus correctly', async () => {
    const correlationId = 'integration_test_123';
    await taskGraphEngine.create('Integration test', correlationId, 'chat-1', 'web');

    mockTestHelper.assertEventOccurred('task.created', correlationId);
    console.log('✅ EventBus integration works');
  });

  it('should handle events from other components', async () => {
    const correlationId = 'integration_event_test';
    const graph = await taskGraphEngine.create('Event test', correlationId, 'chat-1', 'web');
    const task = taskGraphEngine.getNextTask(graph.id);

    // @ts-ignore
    const emitter = global.mockInternalEmitterIntegration;

    // Simular evento tool.result de otro componente
    emitter.emit('tool.result', {
      payload: {
        graphId: graph.id,
        taskId: task!.id,
        result: { success: true },
        success: true
      },
      correlationId,
    });

    // Esperar rrocesamiento
    await new Promise(resolve => setTimeout(resolve, 50));

    const updatedGraph = taskGraphEngine.getGraph(graph.id);
    const completedTask = updatedGraph!.tasks.find((t: any) => t.id === task!.id);

    expect(completedTask!.status).toBe('completed');
    console.log('✅ Event handling from other components works');
  });
});
