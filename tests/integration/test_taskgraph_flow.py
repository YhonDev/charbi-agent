#!/usr/bin/env python3
"""
🧪 Integration Tests - TaskGraph Flow
Pruebas de integración para el flujo completo de TaskGraph
"""

import pytest
import asyncio
import time
from pathlib import Path
import sys
import json

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'kernel'))

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE FLUJO COMPLETO
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.integration
class TestTaskGraphFlow:
    """Tests para flujo completo de TaskGraph"""
    
    @pytest.fixture
    async def setup_kernel(self):
        """Configurar kernel para tests de integración"""
        from kernel.bootstrap import start_kernel_test_mode
        kernel = await start_kernel_test_mode()
        yield kernel
        await kernel.shutdown()
    
    @pytest.mark.asyncio
    async def test_full_taskgraph_execution(self, setup_kernel):
        """Ejecución completa de TaskGraph"""
        from kernel.core.event_bus import eventBus
        from kernel.planning.task_graph import taskGraphEngine
        
        events_received = []
        
        def capture_event(event):
            events_received.append(event)
        
        eventBus.on('TASKGRAPH_CREATED', capture_event)
        eventBus.on('TASK_START', capture_event)
        eventBus.on('TASK_COMPLETE', capture_event)
        eventBus.on('TASKGRAPH_COMPLETE', capture_event)
        
        eventBus.emit({
            'type': 'USER_REQUEST',
            'payload': {
                'prompt': 'Create a website with HTML, CSS, and JS',
                'userId': 'test_user',
                'mode': 'autonomous'
            },
            'correlationId': 'test_123'
        })
        
        await asyncio.sleep(5)
        
        event_types = [e['type'] for e in events_received]
        
        assert 'TASKGRAPH_CREATED' in event_types
        assert 'TASK_START' in event_types
        assert 'TASK_COMPLETE' in event_types
        assert 'TASKGRAPH_COMPLETE' in event_types
    
    @pytest.mark.asyncio
    async def test_taskgraph_with_dependencies(self, setup_kernel):
        """TaskGraph con dependencias entre tareas"""
        from kernel.planning.task_graph import taskGraphEngine
        
        graph = await taskGraphEngine.create(
            "Build project with dependencies",
            "test_456"
        )
        
        graph['tasks'][0]['id'] = 'task_1'
        graph['tasks'][1]['id'] = 'task_2'
        graph['tasks'][1]['dependencies'] = ['task_1']
        
        task1 = taskGraphEngine.getNextTask(graph['id'])
        assert task1['id'] == 'task_1'
        
        taskGraphEngine.completeTask(graph['id'], 'task_1', {'result': 'done'})
        
        task2 = taskGraphEngine.getNextTask(graph['id'])
        assert task2['id'] == 'task_2'
    
    @pytest.mark.asyncio
    async def test_taskgraph_retry_on_failure(self, setup_kernel):
        """TaskGraph reintenta tareas fallidas"""
        from kernel.planning.task_graph import taskGraphEngine
        
        graph = await taskGraphEngine.create("Test retry", "test_789")
        
        for i in range(3):
            taskGraphEngine.failTask(graph['id'], graph['tasks'][0]['id'], f'Error {i}')
        
        final_graph = taskGraphEngine.getStatus(graph['id'])
        assert final_graph['status'] == 'failed'

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE INTEGRACIÓN CON LLM
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.integration
@pytest.mark.requires_llm
class TestLLMIntegration:
    """Tests para integración con LLM"""
    
    @pytest.fixture
    def llm_connector(self):
        from kernel.connectors.ollama_connector import OllamaConnector
        return OllamaConnector(model='llama3.2', endpoint='http://localhost:11434')
    
    @pytest.mark.asyncio
    async def test_llm_generates_valid_task_graph(self, llm_connector):
        """LLM genera TaskGraph válido"""
        from kernel.core.intelligence_proxy import IntelligenceProxy
        
        proxy = IntelligenceProxy(llm_connector)
        
        prompt = """
Break down this task into steps:
"Create a simple website with HTML, CSS, and JS"

Respond in JSON format with tasks array.
"""
        
        response = await proxy.generate(prompt, {
            'mode': 'planning',
            'temperature': 0.3,
            'jsonMode': True
        })
        
        try:
            parsed = json.loads(response['content'])
            assert 'tasks' in parsed
            assert isinstance(parsed['tasks'], list)
            assert len(parsed['tasks']) >= 2
        except json.JSONDecodeError:
            pytest.fail("LLM did not return valid JSON")
    
    @pytest.mark.asyncio
    async def test_llm_assesses_complexity_correctly(self, llm_connector):
        """LLM evalúa complejidad correctamente"""
        from kernel.core.intelligence_proxy import IntelligenceProxy
        
        proxy = IntelligenceProxy(llm_connector)
        
        simple_prompt = "What time is it?"
        complex_prompt = "Create a full-stack application with database"
        
        simple_response = await proxy.generate(
            f"Is this task complex? Respond YES or NO: {simple_prompt}",
            {'mode': 'analysis', 'temperature': 0.2}
        )
        
        complex_response = await proxy.generate(
            f"Is this task complex? Respond YES or NO: {complex_prompt}",
            {'mode': 'analysis', 'temperature': 0.2}
        )
        
        assert 'NO' in simple_response['content'].upper() or 'SIMPLE' in simple_response['content'].upper()
        assert 'YES' in complex_response['content'].upper() or 'COMPLEX' in complex_response['content'].upper()

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE INTEGRACIÓN CON MEMORY SERVER
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.integration
@pytest.mark.requires_memory
class TestMemoryServerIntegration:
    """Tests para integración con Memory Server"""
    
    @pytest.fixture
    async def memory_server(self):
        import subprocess
        import aiohttp
        
        process = subprocess.Popen(
            ['python3', 'memory-server/server.py'],
            cwd=Path.home() / '.charbi-agent-v2'
        )
        
        await asyncio.sleep(2)
        
        yield aiohttp.ClientSession(base_url='http://localhost:5006')
        
        process.terminate()
        process.wait()
    
    @pytest.mark.asyncio
    async def test_memory_write_and_read(self, memory_server):
        """Escribir y leer de Memory Server"""
        write_response = await memory_server.post(
            '/api/v1/memory/write',
            json={
                'userId': 'test_user',
                'content': 'Test memory content',
                'metadata': {'type': 'test', 'confidence': 0.9}
            }
        )
        
        assert write_response.status == 200
        write_data = await write_response.json()
        assert 'id' in write_data
        
        read_response = await memory_server.get(
            '/api/v1/memory/recent',
            params={'userId': 'test_user', 'limit': 10}
        )
        
        assert read_response.status == 200
        read_data = await read_response.json()
        assert len(read_data) >= 1
        assert read_data[-1]['content'] == 'Test memory content'
    
    @pytest.mark.asyncio
    async def test_memory_search(self, memory_server):
        """Búsqueda semántica en Memory Server"""
        for i in range(5):
            await memory_server.post(
                '/api/v1/memory/write',
                json={
                    'userId': 'test_user',
                    'content': f'Test memory {i} about Python programming',
                    'metadata': {'type': 'fact'}
                }
            )
        
        search_response = await memory_server.get(
            '/api/v1/memory/search',
            params={'userId': 'test_user', 'q': 'programming language', 'limit': 3}
        )
        
        assert search_response.status == 200
        search_data = await search_response.json()
        assert len(search_data) <= 3
 Riverside
