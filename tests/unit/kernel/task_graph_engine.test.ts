/**
 * 🧪 TaskGraphEngine - Test Suite Completo
 * Con debugging integrado y mejores mensajes de error
 */

import { TaskGraphEngine } from '../../../kernel/task_graph/task_graph_engine';
import {
  TaskGraphTestHelper,
  createTestTask,
  createTestTaskGraph,
  waitForCondition
} from './helpers/task-graph-test-helpers';

// ✅ Helper global para todos los tests
const testHelper = new TaskGraphTestHelper();

// ✅ Mock de EventBus CON LOGGING
jest.mock('../../../kernel/event_bus', () => ({
  eventBus: testHelper.createMockEventBus(),
  EventType: jest.requireActual('../../../kernel/event_bus').EventType,
  emitEvent: jest.fn((e) => testHelper.getEmitter().emit(e.type, e))
}));

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
                description: 'Create test file',
                tool: 'system.write',
                toolArgs: { path: '/tmp/test.txt', content: 'test' },
                dependencies: [],
              },
            ],
          }),
          toolCalls: [],
          thought: 'Test thought process',
        };
      }),
    })),
  },
}));

// Mock de ToolRegistry para evitar escaneo real
jest.mock('../../../kernel/tool_registry', () => ({
  toolRegistry: {
    getTool: jest.fn((name) => ({ schema: { name }, handler: jest.fn() })),
    getAllSchemas: jest.fn(() => []),
    listNames: jest.fn(() => [])
  }
}));

describe('TaskGraphEngine', () => {
  let taskGraphEngine: TaskGraphEngine;
  let correlationId: string;

  beforeEach(() => {
    // ✅ Reset helper para cada test
    testHelper.reset();

    // ✅ Limpiar singleton
    // @ts-ignore
    TaskGraphEngine.instance = undefined;

    // ✅ Obtener instancia fresca
    taskGraphEngine = TaskGraphEngine.getInstance();
    correlationId = `test_${Date.now()}`;
  });

  afterEach(() => {
    testHelper.reset();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // COMPLEXITY ASSESSMENT TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Complexity Assessment', () => {
    it('should detect simple tasks (score < 40/60 threshold)', async () => {
      // Usamos una cadena simple que no dispare patrones
      const result = await taskGraphEngine.assessComplexity('Hola');

      expect(result).toBeDefined();
      expect(result.isComplex).toBe(false);
      expect(result.score).toBeLessThan(40);

      console.log(`✅ Simple prompt detected: "Hola" (score: ${result.score})`);
    });

    it('should detect complex tasks using patterns', async () => {
      // Cadena con muchos verbos de acción
      const prompt = 'Crea, analiza, investiga y luego escribe un reporte';
      const result = await taskGraphEngine.assessComplexity(prompt);

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
      expect(graph.tasks.length).toBeGreaterThan(0);
      expect(graph.correlationId).toBe(correlationId);
      expect(graph.status).toBe('executing');

      console.log(`✅ TaskGraph created: ${graph.id}`);
    });

    it('should emit task.created event', async () => {
      await taskGraphEngine.create('Test task', correlationId, 'chat-1', 'web');

      // ✅ Usar helper para verificar evento (usando nombres de eventos reales de event_bus.ts)
      testHelper.assertEventOccurred('task.created', correlationId);

      console.log('✅ task.created event emitted');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TASK EXECUTION TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Task Execution', () => {
    it('should get next pending task', async () => {
      const graph = await taskGraphEngine.create('Test task', correlationId, 'chat-1', 'web');
      const task = taskGraphEngine.getNextTask(graph.id);

      expect(task).toBeDefined();
      expect(task!.status).toBe('in_progress');

      console.log(`✅ Task retrieved: ${task!.id}`);
    });

    it('should complete task successfully', async () => {
      const graph = await taskGraphEngine.create('Test task', correlationId, 'chat-1', 'web');
      const task = taskGraphEngine.getNextTask(graph.id);

      const result = { success: true, data: 'test data' };
      taskGraphEngine.completeTask(graph.id, task!.id, result);

      const updatedGraph = taskGraphEngine.getGraph(graph.id);
      const completedTask = updatedGraph!.tasks.find(t => t.id === task!.id);

      expect(completedTask!.status).toBe('completed');

      // ✅ Verificar evento emitido
      testHelper.assertEventOccurred('task.completed', correlationId);

      console.log('✅ Task completed successfully');
    });

    it('should fail task and increment retryCount', async () => {
      const graph = await taskGraphEngine.create('Test task', correlationId, 'chat-1', 'web');
      const task = taskGraphEngine.getNextTask(graph.id);

      taskGraphEngine.failTask(graph.id, task!.id, 'Error 1');

      const updatedTask = taskGraphEngine.getGraph(graph.id)!.tasks.find(t => t.id === task!.id);
      expect(updatedTask!.retryCount).toBe(1);
      expect(updatedTask!.status).toBe('failed');

      // ✅ Verificar evento de fallo
      testHelper.assertEventOccurred('task.failed', correlationId);
    });
  });
});
