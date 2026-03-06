/**
 * 🧪 TaskGraph Integration Tests
 * Tests de integración con EventBus, Proxy, etc.
 */

import { TaskGraphEngine } from '../../../kernel/task_graph/task_graph_engine';
import { TaskGraphTestHelper } from './helpers/task-graph-test-helpers';

const testHelper = new TaskGraphTestHelper();
const mockEventBus = testHelper.createMockEventBus();

jest.mock('../../../kernel/event_bus', () => {
  const actual = jest.requireActual('../../../kernel/event_bus');
  return {
    ...actual,
    eventBus: mockEventBus,
    emitEvent: jest.fn((e) => {
      testHelper.getEmitter().emit(e.type, e);
      mockEventBus.emit(e.type, e);
    })
  };
});

jest.mock('../../../kernel/cognition/intelligence_proxy', () => ({
  IntelligenceProxy: {
    getInstance: jest.fn(() => ({
      generate: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          tasks: [
            {
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
    getTool: jest.fn((name) => ({ schema: { name }, handler: jest.fn() })),
    getAllSchemas: jest.fn(() => []),
    listNames: jest.fn(() => [])
  }
}));

describe('TaskGraph Integration', () => {
  let taskGraphEngine: TaskGraphEngine;

  beforeEach(() => {
    testHelper.reset();
    mockEventBus.emit.mockClear();
    mockEventBus.on.mockClear();
    // @ts-ignore
    TaskGraphEngine.instance = undefined;
    taskGraphEngine = TaskGraphEngine.getInstance();
  });

  it('should integrate with EventBus correctly', async () => {
    const correlationId = 'integration_test_123';

    await taskGraphEngine.create('Integration test', correlationId, 'chat-1', 'web');

    // ✅ Verificar que EventBus.emit fue llamado (usando nombres de eventos reales)
    expect(mockEventBus.emit).toHaveBeenCalled();

    // Buscar el evento de creación de grafo/tarea
    const emitCalls = mockEventBus.emit.mock.calls;
    const eventTypes = emitCalls.map((call: any[]) => call[0]);

    expect(eventTypes).toContain('task.created');

    console.log('✅ EventBus integration works');
  });

  it('should handle events from other components', async () => {
    const correlationId = 'integration_event_test';
    const graph = await taskGraphEngine.create('Event test', correlationId, 'chat-1', 'web');
    const task = taskGraphEngine.getNextTask(graph.id);

    // ✅ Simular evento tool.result de otro componente (Orchestrator)
    testHelper.getEmitter().emit('tool.result', {
      payload: {
        graphId: graph.id,
        taskId: task!.id,
        result: { success: true },
        success: true
      },
      correlationId,
    });

    // ✅ Esperar a que se procese el evento asíncrono
    await new Promise(resolve => setTimeout(resolve, 50));

    const updatedGraph = taskGraphEngine.getGraph(graph.id);
    const completedTask = updatedGraph!.tasks.find((t: any) => t.id === task!.id);

    expect(completedTask!.status).toBe('completed');

    console.log('✅ Event handling from other components works');
  });
});
