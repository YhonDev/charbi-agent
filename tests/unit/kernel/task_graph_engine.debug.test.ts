/**
 * 🐛 TaskGraphEngine - Debug Tests
 * Tests diseñados específicamente para identificar problemas
 */

import { TaskGraphEngine } from '../../../kernel/task_graph/task_graph_engine';
import { TaskGraphTestHelper } from './helpers/task-graph-test-helpers';

const testHelper = new TaskGraphTestHelper();

jest.mock('../../../kernel/event_bus', () => ({
  eventBus: testHelper.createMockEventBus(),
  EventType: jest.requireActual('../../../kernel/event_bus').EventType,
  emitEvent: jest.fn((e) => testHelper.getEmitter().emit(e.type, e))
}));

jest.mock('../../../kernel/cognition/intelligence_proxy', () => ({
  IntelligenceProxy: {
    getInstance: jest.fn(() => ({
      generate: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          tasks: [
            {
              description: 'Debug test task',
              tool: 'system.write',
              toolArgs: { path: '/tmp/debug.txt', content: 'debug' },
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
    getTool: jest.fn((name) => ({ schema: { name }, handler: jest.fn() })),
    getAllSchemas: jest.fn(() => []),
    listNames: jest.fn(() => [])
  }
}));

describe('TaskGraphEngine - Debug Scenarios', () => {
  let taskGraphEngine: TaskGraphEngine;

  beforeEach(() => {
    testHelper.reset();
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

    // ✅ Imprimir flujo completo SIEMPRE en debug tests
    testHelper.printFlow(correlationId);

    expect(graph).toBeDefined();
  });

  it('DEBUG: Should show all registered event handlers', () => {
    console.log('\n🔍 DEBUG TEST: Event Handler Registration\n');

    // ✅ Verificar handlers registrados
    const eventTypes = [
      'task.completed',
      'task.failed',
      'tool.result',
    ];

    for (const eventType of eventTypes) {
      const listenerCount = testHelper.getEmitter().listenerCount(eventType);
      console.log(`  ${eventType}: ${listenerCount} listener(s)`);
      expect(listenerCount).toBeGreaterThan(0);
    }
  });
});
