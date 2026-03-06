/**
 * 🧪 TaskGraphEngine - Test Suite Completo
 * Con debugging integrado y mejores mensajes de error
 */

import { EventEmitter } from 'events';
import {
  TaskGraphTestHelper,
  waitForCondition
} from './helpers/task-graph-test-helpers';

// ✅ Prefijo 'mock' permite usarlo en jest.mock (hoisting seguro)
/** @type {any} */
var mockInternalEmitter: any;

// ✅ Mock de EventBus CON LOGGING (Auto-contenido para evitar TDZ)
jest.mock('../../../kernel/event_bus', () => {
  const Emitter = require('events').EventEmitter;
  const internalEmitter = new Emitter();

  // Guardamos una referencia global (prefeijada con mock) para el test
  // @ts-ignore
  global.mockInternalEmitter = internalEmitter;

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
    AGENT_THINK: 'agent.think',
    TASK_CREATED: 'task.created',
    TASK_STARTED: 'task.started',
    TASK_COMPLETED: 'task.completed',
    TASK_FAILED: 'task.failed',
    TOOL_CALLED: 'tool.called',
    TOOL_RESULT: 'tool.result',
    AGENT_RESPONSE: 'agent.response',
    AGENT_STATUS: 'agent.status',
    SYSTEM_READY: 'system.ready'
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

// ✅ Mock de IntelligenceProxy
jest.mock('../../../kernel/cognition/intelligence_proxy', () => ({
  IntelligenceProxy: {
    getInstance: jest.fn(() => ({
      generate: jest.fn().mockImplementation(async (prompt: string, config: any) => {
        console.log('[Mock LLM] Generating response for prompt:', prompt.substring(0, 100));

        // Simular delay de LLM real
        await new Promise(resolve => setTimeout(resolve, 10));

        return {
          content: JSON.stringify({
            tasks: [
              {
                id: 'task_1',
                description: 'Create test file',
                tool: 'system.write',
                toolArgs: { path: '/tmp/test.txt', content: 'test' },
                dependencies: [],
              },
              {
                id: 'task_2',
                description: 'List files',
                tool: 'system.list',
                toolArgs: { path: '/tmp' },
                dependencies: ['task_1'],
              }
            ],
          }),
          toolCalls: [],
          thought: 'Test thought process',
        };
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

// ✅ AHORA SI importamos el engine (después de definir el mock)
// @ts-ignore
import { TaskGraphEngine } from '../../../kernel/task_graph/task_graph_engine';

describe('TaskGraphEngine', () => {
  let taskGraphEngine: TaskGraphEngine;
  let correlationId: string;
  let mockTestHelper: TaskGraphTestHelper;

  beforeEach(() => {
    // ✅ Obtener el emitter del mock inyectado en global
    // @ts-ignore
    const emitter = global.mockInternalEmitter;

    // ✅ Inicializar helper con el emitter real usado en el mock
    mockTestHelper = new TaskGraphTestHelper();
    // @ts-ignore
    mockTestHelper.realEmitter = emitter;

    // ✅ Reset emitter
    emitter.removeAllListeners();
    mockTestHelper.reset();

    // ✅ Limpiar singleton
    // @ts-ignore
    TaskGraphEngine.instance = undefined;

    // ✅ Obtener instancia fresca
    taskGraphEngine = TaskGraphEngine.getInstance();
    correlationId = `test_${Date.now()}`;

    console.log('\n' + '='.repeat(80));
    console.log(`STARTING TEST: ${expect.getState().currentTestName}`);
    console.log('='.repeat(80) + '\n');
  });

  afterEach(() => {
    console.log('\n' + '='.repeat(80));
    console.log(`ENDING TEST: ${expect.getState().currentTestName}`);

    // ✅ Imprimir flujo de eventos si el test falló
    if (expect.getState().numFailedTests && expect.getState().numFailedTests > 0) {
      console.log('\n⚠️  TEST FAILED - EVENT FLOW:\n');
      mockTestHelper.printFlow(correlationId);
    }

    console.log('='.repeat(80) + '\n');

    mockTestHelper.reset();
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // COMPLEXITY ASSESSMENT TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Complexity Assessment', () => {
    it('should detect simple tasks (score < 40 threshold)', async () => {
      const result = await taskGraphEngine.assessComplexity('Hola', correlationId);
      expect(result.isComplex).toBe(false);
      expect(result.score).toBeLessThan(40);
      console.log(`✅ Simple prompt detected: "Hola" (score: ${result.score})`);
    });

    it('should detect complex tasks using patterns', async () => {
      const prompt = 'Crea, analiza, investiga y luego escribe un reporte en /home/yhondev/reporte.txt';
      const result = await taskGraphEngine.assessComplexity(prompt, correlationId);

      expect(result.isComplex).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(40);

      console.log(`✅ Complex prompt detected: "${prompt}" (score: ${result.score})`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TASK GRAPH CREATION TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Task Graph Creation', () => {
    it('should create task graph for complex tasks', async () => {
      const graph = await taskGraphEngine.create(
        'Create a simple website',
        correlationId,
        'chat-1',
        'web'
      );

      expect(graph).toBeDefined();
      expect(graph.objective).toBe('Create a simple website');
      expect(graph.tasks.length).toBe(2);
      expect(graph.correlationId).toBe(correlationId);
      expect(graph.status).toBe('executing');

      console.log(`✅ TaskGraph created: ${graph.id}`);
    });

    it('should emit task.created event', async () => {
      await taskGraphEngine.create('Test task', correlationId, 'chat-1', 'web');
      mockTestHelper.assertEventOccurred('task.created', correlationId);
      console.log('✅ task.created event emitted');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TASK EXECUTION TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Task Execution', () => {
    it('should respect task dependencies', async () => {
      const graph = await taskGraphEngine.create('Multi-step task', correlationId, 'chat-1', 'web');

      // La primera tarea debe ser task_1 (sin dependencias)
      const task1 = taskGraphEngine.getNextTask(graph.id);
      expect(task1!.id).toBe('task_1');

      // La segunda tarea (task_2) no debería estar disponible aún
      const task2Placeholder = taskGraphEngine.getNextTask(graph.id);
      expect(task2Placeholder).toBeNull(); // Porque task_1 está in_progress

      // Completamos task_1
      taskGraphEngine.completeTask(graph.id, 'task_1', { success: true });

      // Ahora task_2 debería estar disponible
      const task2 = taskGraphEngine.getNextTask(graph.id);
      expect(task2!.id).toBe('task_2');

      console.log('✅ Dependencies respected correctly');
    });

    it('should complete graph when all tasks succeed', async () => {
      const graph = await taskGraphEngine.create('Full project', correlationId, 'chat-1', 'web');

      // Completar task_1
      const t1 = taskGraphEngine.getNextTask(graph.id);
      taskGraphEngine.completeTask(graph.id, t1!.id, { success: true });

      // Completar task_2
      const t2 = taskGraphEngine.getNextTask(graph.id);
      taskGraphEngine.completeTask(graph.id, t2!.id, { success: true });

      // ✅ Esperar a que el grafo se complete (async internal event handling)
      await waitForCondition(
        () => taskGraphEngine.getGraph(graph.id)?.status === 'completed',
        2000,
        'graph completion'
      );

      const finalGraph = taskGraphEngine.getGraph(graph.id);
      expect(finalGraph!.status).toBe('completed');

      mockTestHelper.assertEventOccurred('agent.response', correlationId);
      mockTestHelper.printFlow(correlationId);

      console.log('✅ Graph completed successfully');
    });

    it('should fail task and retry', async () => {
      const graph = await taskGraphEngine.create('Retry test', correlationId, 'chat-1', 'web');
      const task = taskGraphEngine.getNextTask(graph.id);

      taskGraphEngine.failTask(graph.id, task!.id, 'Network error');

      const updatedGraph = taskGraphEngine.getGraph(graph.id);
      const failedTask = updatedGraph!.tasks.find(t => t.id === task!.id);

      expect(failedTask!.status).toBe('failed');
      expect(failedTask!.retryCount).toBe(1);

      mockTestHelper.assertEventOccurred('task.failed', correlationId);
      console.log('✅ Task failed and retry count incremented');
    });
  });
});
