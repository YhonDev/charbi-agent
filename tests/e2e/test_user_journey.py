#!/usr/bin/env python3
"""
🧪 E2E Tests - User Journey
Pruebas end-to-end del flujo completo de usuario
"""

import pytest
import asyncio
import aiohttp
import time
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'cli' / 'src'))

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE JOURNEY COMPLETO
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.e2e
@pytest.mark.slow
class TestUserJourney:
    """Tests para journey completo de usuario"""
    
    @pytest.fixture(scope="class")
    async def setup_full_system(self):
        """Configurar sistema completo para E2E"""
        import subprocess
        
        memory_process = subprocess.Popen(
            ['python3', 'memory-server/server.py'],
            cwd=Path.home() / '.charbi-agent-v2'
        )
        await asyncio.sleep(2)
        
        kernel_process = subprocess.Popen(
            ['npx', 'ts-node', 'kernel/bootstrap.ts'],
            cwd=Path.home() / '.charbi-agent-v2' / 'kernel'
        )
        await asyncio.sleep(3)
        
        yield {
            'gateway_url': 'http://localhost:5005',
            'memory_url': 'http://localhost:5006'
        }
        
        kernel_process.terminate()
        memory_process.terminate()
        kernel_process.wait()
        memory_process.wait()
    
    @pytest.mark.asyncio
    async def test_simple_chat_request(self, setup_full_system):
        """Solicitud simple de chat"""
        async with aiohttp.ClientSession() as session:
            response = await session.post(
                f"{setup_full_system['gateway_url']}/api/v1/chat",
                json={
                    'prompt': 'Hello, what can you do?',
                    'userId': 'test_user',
                    'mode': 'chat'
                },
                timeout=aiohttp.ClientTimeout(total=30)
            )
            
            assert response.status == 200
            
            content = ''
            async for line in response.content:
                if line.startswith(b'data: '):
                    content += line.decode()
            
            assert len(content) > 0
    
    @pytest.mark.asyncio
    async def test_complex_task_with_taskgraph(self, setup_full_system):
        """Tarea compleja con TaskGraph"""
        async with aiohttp.ClientSession() as session:
            response = await session.post(
                f"{setup_full_system['gateway_url']}/api/v1/chat",
                json={
                    'prompt': 'Create a simple website with HTML and CSS',
                    'userId': 'test_user',
                    'mode': 'autonomous'
                },
                timeout=aiohttp.ClientTimeout(total=120)
            )
            
            assert response.status == 200
            
            events = []
            async for line in response.content:
                if line.startswith(b'data: '):
                    events.append(line.decode())
            
            taskgraph_events = [e for e in events if 'TASKGRAPH_CREATED' in e]
            assert len(taskgraph_events) > 0
    
    @pytest.mark.asyncio
    async def test_multi_session_continuity(self, setup_full_system):
        """Continuidad entre múltiples sesiones"""
        async with aiohttp.ClientSession() as session:
            await session.post(
                f"{setup_full_system['gateway_url']}/api/v1/chat",
                json={
                    'prompt': 'Remember that my favorite language is Python',
                    'userId': 'test_user',
                    'mode': 'chat',
                    'storeMemory': True
                }
            )
            
            await asyncio.sleep(1)
            
            response = await session.post(
                f"{setup_full_system['gateway_url']}/api/v1/chat",
                json={
                    'prompt': 'What is my favorite language?',
                    'userId': 'test_user',
                    'mode': 'chat',
                    'useMemory': True
                }
            )
            
            content = await response.text()
            
            assert 'python' in content.lower()

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE RENDIMIENTO
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.e2e
@pytest.mark.slow
class TestPerformance:
    """Tests de rendimiento del sistema"""
    
    @pytest.fixture(scope="class")
    async def setup_full_system(self):
        import subprocess
        
        memory_process = subprocess.Popen(
            ['python3', 'memory-server/server.py'],
            cwd=Path.home() / '.charbi-agent-v2'
        )
        await asyncio.sleep(2)
        
        kernel_process = subprocess.Popen(
            ['npx', 'ts-node', 'kernel/bootstrap.ts'],
            cwd=Path.home() / '.charbi-agent-v2' / 'kernel'
        )
        await asyncio.sleep(3)
        
        yield {
            'gateway_url': 'http://localhost:5005'
        }
        
        kernel_process.terminate()
        memory_process.terminate()
        kernel_process.wait()
        memory_process.wait()
    
    @pytest.mark.asyncio
    async def test_response_time_simple_request(self, setup_full_system):
        """Tiempo de respuesta para solicitud simple"""
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            
            response = await session.post(
                f"{setup_full_system['gateway_url']}/api/v1/chat",
                json={
                    'prompt': 'Hello',
                    'userId': 'test_user',
                    'mode': 'chat'
                }
            )
            
            await response.text()
            elapsed = time.time() - start_time
            
            assert elapsed < 5.0
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, setup_full_system):
        """Múltiples solicitudes concurrentes"""
        async with aiohttp.ClientSession() as session:
            async def make_request(i):
                response = await session.post(
                    f"{setup_full_system['gateway_url']}/api/v1/chat",
                    json={
                        'prompt': f'Request {i}',
                        'userId': 'test_user',
                        'mode': 'chat'
                    }
                )
                return response.status
            
            tasks = [make_request(i) for i in range(10)]
            results = await asyncio.gather(*tasks)
            
            assert all(status == 200 for status in results)
