#!/usr/bin/env python3
"""
🧪 Unit Tests - Task Graph Engine
Pruebas unitarias para el TaskGraphEngine
"""

import pytest
import asyncio
import time
import json
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import sys

# Redirigir al proyecto raíz
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE COMPLEJIDAD
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestComplexityAssessment:
    """Tests para evaluación de complejidad"""
    
    @pytest.fixture
    def task_graph_engine(self):
        """Crear TaskGraphEngine para tests"""
        from kernel.planning.task_graph import TaskGraphEngine
        engine = TaskGraphEngine.getInstance()
        engine.graphs.clear()
        return engine
    
    def test_simple_prompt_returns_not_complex(self, task_graph_engine):
        """Prompt simple no requiere TaskGraph"""
        prompt = "¿Qué hora es?"
        
        with patch.object(task_graph_engine, 'assessComplexityWithLLM') as mock_llm:
            mock_llm.return_value = {'isComplex': False, 'reasons': []}
            
            result = asyncio.run(task_graph_engine.assessComplexity(prompt))
        
        assert result['isComplex'] == False
        assert result['score'] < 40
    
    def test_create_web_returns_complex(self, task_graph_engine):
        """'Crear web' sí requiere TaskGraph"""
        prompt = "Crea una web con HTML, CSS y JS"
        
        with patch.object(task_graph_engine, 'assessComplexityWithLLM') as mock_llm:
            mock_llm.return_value = {'isComplex': True, 'reasons': ['Contains complex patterns']}
            
            result = asyncio.run(task_graph_engine.assessComplexity(prompt))
        
        assert result['isComplex'] == True
        assert result['score'] >= 40
        assert 'crea' in str(result['reasons']).lower()
    
    def test_multiple_action_verbs_increases_score(self, task_graph_engine):
        """Múltiples verbos de acción aumentan score"""
        prompt = "Investiga, analiza y crea un informe completo"
        
        with patch.object(task_graph_engine, 'assessComplexityWithLLM') as mock_llm:
            mock_llm.return_value = {'isComplex': True, 'reasons': []}
            
            result = asyncio.run(task_graph_engine.assessComplexity(prompt))
        
        assert result['score'] >= 30  # 30 puntos por verbos múltiples
        assert 'Multiple actions' in str(result['reasons'])
    
    def test_sequential_words_increases_score(self, task_graph_engine):
        """Palabras secuenciales aumentan score"""
        prompt = "Primero investiga, luego analiza, finalmente crea"
        
        with patch.object(task_graph_engine, 'assessComplexityWithLLM') as mock_llm:
            mock_llm.return_value = {'isComplex': True, 'reasons': []}
            
            result = asyncio.run(task_graph_engine.assessComplexity(prompt))
        
        assert result['score'] >= 15  # 15 puntos por secuencia
        assert 'Sequential' in str(result['reasons'])
    
    def test_long_prompt_increases_score(self, task_graph_engine):
        """Prompt largo aumenta score"""
        prompt = " ".join(["word"] * 20)  # 20 palabras
        
        with patch.object(task_graph_engine, 'assessComplexityWithLLM') as mock_llm:
            mock_llm.return_value = {'isComplex': False, 'reasons': []}
            
            result = asyncio.run(task_graph_engine.assessComplexity(prompt))
        
        assert result['score'] >= 20  # 20 puntos por longitud

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE CREACIÓN DE TASKGRAPH
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestTaskGraphCreation:
    """Tests para creación de TaskGraph"""
    
    @pytest.fixture
    def task_graph_engine(self):
        from kernel.planning.task_graph import TaskGraphEngine
        engine = TaskGraphEngine.getInstance()
        engine.graphs.clear()
        return engine
    
    @pytest.mark.asyncio
    async def test_create_generates_tasks(self, task_graph_engine):
        """Crear TaskGraph genera tareas"""
        objective = "Create a simple website"
        correlation_id = "test_123"
        
        with patch.object(task_graph_engine, 'generateTasksWithLLM') as mock_generate:
            mock_generate.return_value = [
                {
                    'id': 'task_1',
                    'description': 'Create index.html',
                    'tool': 'file_manager',
                    'status': 'pending',
                    'dependencies': [],
                    'retryCount': 0,
                    'createdAt': time.time()
                }
            ]
            
            graph = await task_graph_engine.create(objective, correlation_id)
        
        assert graph['objective'] == objective
        assert len(graph['tasks']) >= 1
        assert graph['status'] == 'executing'
        assert graph['correlationId'] == correlation_id
    
    @pytest.mark.asyncio
    async def test_create_emits_events(self, task_graph_engine):
        """Crear TaskGraph emite eventos"""
        objective = "Create a simple website"
        correlation_id = "test_123"
        
        with patch.object(task_graph_engine, 'generateTasksWithLLM') as mock_generate:
            mock_generate.return_value = []
            
            with patch('kernel.planning.task_graph.eventBus') as mock_bus:
                await task_graph_engine.create(objective, correlation_id)
                
                # Verificar eventos emitidos
                assert mock_bus.emit.call_count >= 2  # PLANNING + CREATED
    
    @pytest.mark.asyncio
    async def test_create_handles_llm_failure(self, task_graph_engine):
        """Crear TaskGraph maneja fallo del LLM"""
        objective = "Create a simple website"
        correlation_id = "test_123"
        
        with patch.object(task_graph_engine, 'generateTasksWithLLM') as mock_generate:
            mock_generate.side_effect = Exception("LLM failed")
            
            graph = await task_graph_engine.create(objective, correlation_id)
        
        # Debería crear tarea fallback
        assert len(graph['tasks']) == 1
        assert graph['tasks'][0]['description'] == objective

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE EJECUCIÓN DE TAREAS
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestTaskExecution:
    """Tests para ejecución de tareas"""
    
    @pytest.fixture
    def task_graph_engine(self):
        from kernel.planning.task_graph import TaskGraphEngine
        engine = TaskGraphEngine.getInstance()
        engine.graphs.clear()
        return engine
    
    @pytest.fixture
    def sample_graph(self, task_graph_engine):
        """TaskGraph de ejemplo para tests"""
        graph = {
            'id': 'tg_test',
            'objective': 'Test objective',
            'tasks': [
                {
                    'id': 'task_1',
                    'description': 'Task 1',
                    'status': 'pending',
                    'dependencies': [],
                    'retryCount': 0,
                    'createdAt': time.time()
                },
                {
                    'id': 'task_2',
                    'description': 'Task 2',
                    'status': 'pending',
                    'dependencies': ['task_1'],
                    'retryCount': 0,
                    'createdAt': time.time()
                }
            ],
            'status': 'executing',
            'currentTaskIndex': 0,
            'correlationId': 'test_123'
        }
        task_graph_engine.graphs.set('tg_test', graph)
        return graph
    
    def test_getNextTask_returns_first_pending(self, task_graph_engine, sample_graph):
        """getNextTask retorna primera tarea pending"""
        task = task_graph_engine.getNextTask('tg_test')
        
        assert task is not None
        assert task['id'] == 'task_1'
        assert task['status'] == 'in_progress'
    
    def test_getNextTask_respects_dependencies(self, task_graph_engine, sample_graph):
        """getNextTask respeta dependencias"""
        # Completar primera tarea
        task_graph_engine.completeTask('tg_test', 'task_1', {'result': 'done'})
        
        # Ahora debería retornar task_2
        task = task_graph_engine.getNextTask('tg_test')
        
        assert task is not None
        assert task['id'] == 'task_2'
    
    def test_getNextTask_returns_null_when_done(self, task_graph_engine, sample_graph):
        """getNextTask retorna null cuando no hay más tareas"""
        # Completar todas las tareas
        task_graph_engine.completeTask('tg_test', 'task_1', {'result': 'done'})
        task_graph_engine.completeTask('tg_test', 'task_2', {'result': 'done'})
        
        task = task_graph_engine.getNextTask('tg_test')
        
        assert task is None
    
    def test_completeTask_updates_status(self, task_graph_engine, sample_graph):
        """completeTask actualiza estado de tarea"""
        task_graph_engine.completeTask('tg_test', 'task_1', {'result': 'success'})
        
        graph = task_graph_engine.getStatus('tg_test')
        task_1 = graph['tasks'][0]
        
        assert task_1['status'] == 'completed'
        assert task_1['result'] == {'result': 'success'}
        assert task_1['completedAt'] is not None
    
    def test_failTask_increments_retryCount(self, task_graph_engine, sample_graph):
        """failTask incrementa retryCount"""
        task_graph_engine.failTask('tg_test', 'task_1', 'Error occurred')
        
        graph = task_graph_engine.getStatus('tg_test')
        task_1 = graph['tasks'][0]
        
        assert task_1['status'] == 'failed'
        assert task_1['error'] == 'Error occurred'
        assert task_1['retryCount'] == 1

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE COMPLETADO DE GRAPH
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestGraphCompletion:
    """Tests para completado de TaskGraph"""
    
    @pytest.fixture
    def task_graph_engine(self):
        from kernel.planning.task_graph import TaskGraphEngine
        engine = TaskGraphEngine.getInstance()
        engine.graphs.clear()
        return engine
    
    @pytest.mark.asyncio
    async def test_completeGraph_when_all_tasks_done(self, task_graph_engine):
        """completeGraph cuando todas las tareas están completas"""
        graph = {
            'id': 'tg_test',
            'objective': 'Test',
            'tasks': [
                {'id': 'task_1', 'status': 'completed', 'dependencies': []},
                {'id': 'task_2', 'status': 'completed', 'dependencies': []}
            ],
            'status': 'executing',
            'correlationId': 'test_123'
        }
        task_graph_engine.graphs.set('tg_test', graph)
        
        with patch('kernel.planning.task_graph.eventBus') as mock_bus:
            task_graph_engine.completeGraph('tg_test')
            
            mock_bus.emit.assert_called()
            
            completed_graph = task_graph_engine.getStatus('tg_test')
            assert completed_graph['status'] == 'completed'
            assert completed_graph['completedAt'] is not None
    
    def test_failGraph_after_max_retries(self, task_graph_engine):
        """failGraph después de máximos reintentos"""
        graph = {
            'id': 'tg_test',
            'objective': 'Test',
            'tasks': [
                {'id': 'task_1', 'status': 'failed', 'retryCount': 3, 'dependencies': []}
            ],
            'status': 'executing',
            'correlationId': 'test_123'
        }
        task_graph_engine.graphs.set('tg_test', graph)
        
        with patch('kernel.planning.task_graph.eventBus') as mock_bus:
            task_graph_engine.failGraph('tg_test', 'Max retries exceeded')
            
            failed_graph = task_graph_engine.getStatus('tg_test')
            assert failed_graph['status'] == 'failed'
            
            mock_bus.emit.assert_called()

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE UTILIDADES
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestTaskGraphUtilities:
    """Tests para utilidades del TaskGraph"""
    
    @pytest.fixture
    def task_graph_engine(self):
        from kernel.planning.task_graph import TaskGraphEngine
        engine = TaskGraphEngine.getInstance()
        engine.graphs.clear()
        return engine
    
    def test_getStatus_returns_graph(self, task_graph_engine):
        """getStatus retorna el graph"""
        graph = {
            'id': 'tg_test',
            'objective': 'Test',
            'tasks': [],
            'status': 'executing'
        }
        task_graph_engine.graphs.set('tg_test', graph)
        
        result = task_graph_engine.getStatus('tg_test')
        
        assert result is not None
        assert result['id'] == 'tg_test'
    
    def test_getStatus_returns_null_for_missing(self, task_graph_engine):
        """getStatus retorna null para graph inexistente"""
        result = task_graph_engine.getStatus('nonexistent')
        
        assert result is None
    
    def test_exportGraph_for_debugging(self, task_graph_engine):
        """exportGraph exporta para debugging"""
        graph = {
            'id': 'tg_test',
            'objective': 'Test',
            'tasks': [
                {'id': 'task_1', 'description': 'Task 1', 'status': 'completed'}
            ],
            'status': 'completed',
            'createdAt': time.time(),
            'completedAt': time.time(),
            'correlationId': 'test_123',
            'metadata': {'complexityScore': 50}
        }
        task_graph_engine.graphs.set('tg_test', graph)
        
        exported = task_graph_engine.exportGraph('tg_test')
        
        assert exported is not None
        assert 'id' in exported
        assert 'tasks' in exported
        assert 'metadata' in exported
    
    def test_cleanup_removes_completed_graphs(self, task_graph_engine):
        """cleanup remueve graphs completados"""
        graph = {
            'id': 'tg_test',
            'objective': 'Test',
            'tasks': [],
            'status': 'completed'
        }
        task_graph_engine.graphs.set('tg_test', graph)
        
        task_graph_engine.cleanup('tg_test')
        
        result = task_graph_engine.getStatus('tg_test')
        assert result is None
