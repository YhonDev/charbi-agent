#!/usr/bin/env python3
"""
🧪 Charbi - Fixtures Globales de Pytest
Configuración compartida para todos los tests
"""

import os
import sys
import pytest
import asyncio
import json
from pathlib import Path
from typing import Generator, AsyncGenerator, Dict, Any
from unittest.mock import Mock, MagicMock, AsyncMock, patch

# Añadir src al path para imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src' / 'python'))
sys.path.insert(0, str(Path(__file__).parent.parent / 'kernel'))

# ═══════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE TEST
# ═══════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def test_config() -> Dict[str, Any]:
    """Configuración de test reutilizable"""
    return {
        "gateway_url": "http://localhost:5005",
        "memory_url": "http://localhost:5006",
        "ollama_url": "http://localhost:11434",
        "timeout": 30,
        "test_user_id": "test_user",
        "test_correlation_id": "test_corr_123",
    }

@pytest.fixture(scope="session")
def test_dirs(tmp_path_factory) -> Dict[str, Path]:
    """Directorios temporales para tests"""
    return {
        "root": tmp_path_factory.mktemp("charbi_test"),
        "config": tmp_path_factory.mktemp("config"),
        "memory": tmp_path_factory.mktemp("memory"),
        "logs": tmp_path_factory.mktemp("logs"),
        "workspace": tmp_path_factory.mktemp("workspace"),
    }

@pytest.fixture(autouse=True)
def set_test_env(test_dirs: Dict[str, Path]) -> Generator:
    """Configurar variables de entorno para tests"""
    original_env = {
        "CHARBI_HOME": os.environ.get("CHARBI_HOME"),
        "CHARBI_ENV": os.environ.get("CHARBI_ENV"),
        "CHARBI_LOG_LEVEL": os.environ.get("CHARBI_LOG_LEVEL"),
    }
    
    os.environ["CHARBI_HOME"] = str(test_dirs["root"])
    os.environ["CHARBI_ENV"] = "test"
    os.environ["CHARBI_LOG_LEVEL"] = "DEBUG"
    
    yield
    
    # Restaurar entorno original
    for key, value in original_env.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value

# ═══════════════════════════════════════════════════════════════════════
# MOCKS REUTILIZABLES
# ═══════════════════════════════════════════════════════════════════════

@pytest.fixture
def mock_llm_connector() -> AsyncMock:
    """Mock para LLM Connector"""
    connector = AsyncMock()
    connector.generate.return_value = {
        "content": "Test response from mock LLM",
        "toolCalls": [],
        "thought": "Test thought process",
        "usage": {
            "promptTokens": 50,
            "completionTokens": 100,
            "totalTokens": 150
        }
    }
    connector.healthCheck.return_value = True
    connector.listModels.return_value = ["llama3.2", "mistral", "codellama"]
    return connector

@pytest.fixture
def mock_event_bus() -> AsyncMock:
    """Mock para Event Bus"""
    bus = AsyncMock()
    bus.emit.return_value = True
    bus.on = MagicMock()
    bus.onWithTimeout = MagicMock()
    bus.removeListener = MagicMock()
    return bus

@pytest.fixture
def mock_memory_server() -> AsyncMock:
    """Mock para Memory Server"""
    server = AsyncMock()
    server.write.return_value = {
        "id": "mem_test_123",
        "status": "success",
        "timestamp": "2024-01-01T00:00:00Z"
    }
    server.read_recent.return_value = []
    server.search.return_value = []
    server.health.return_value = {"status": "healthy"}
    return server

@pytest.fixture
def mock_tool_executor() -> AsyncMock:
    """Mock para Tool Executor"""
    executor = AsyncMock()
    executor.execute.return_value = {
        "success": True,
        "result": "Tool executed successfully",
        "output": "test output"
    }
    executor.validate.return_value = True
    return executor

@pytest.fixture
def mock_context_builder() -> AsyncMock:
    """Mock para Context Builder"""
    builder = AsyncMock()
    builder.build.return_value = [
        {"role": "system", "content": "You are Charbi assistant"},
        {"role": "user", "content": "Test message"}
    ]
    return builder

# ═══════════════════════════════════════════════════════════════════════
# DATOS DE TEST
# ═══════════════════════════════════════════════════════════════════════

@pytest.fixture
def sample_user_request() -> Dict[str, Any]:
    """Solicitud de usuario de ejemplo"""
    return {
        "prompt": "Create a simple website with HTML, CSS, and JavaScript",
        "userId": "test_user",
        "mode": "autonomous",
        "correlationId": "test_corr_123",
        "timestamp": "2024-01-01T00:00:00Z"
    }

@pytest.fixture
def sample_task_graph() -> Dict[str, Any]:
    """TaskGraph de ejemplo"""
    return {
        "id": "tg_test_123",
        "objective": "Create a simple website",
        "tasks": [
            {
                "id": "task_1",
                "description": "Create index.html with basic HTML structure",
                "tool": "file_manager",
                "toolArgs": {
                    "action": "write",
                    "path": "./website/index.html",
                    "content": "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>"
                },
                "status": "pending",
                "dependencies": [],
                "retryCount": 0,
                "createdAt": 1704067200000
            },
            {
                "id": "task_2",
                "description": "Create style.css with basic styling",
                "tool": "file_manager",
                "toolArgs": {
                    "action": "write",
                    "path": "./website/style.css",
                    "content": "body { font-family: Arial; }"
                },
                "status": "pending",
                "dependencies": [],
                "retryCount": 0,
                "createdAt": 1704067200000
            },
            {
                "id": "task_3",
                "description": "Create app.js with basic interactivity",
                "tool": "file_manager",
                "toolArgs": {
                    "action": "write",
                    "path": "./website/app.js",
                    "content": "console.log('Hello World');"
                },
                "status": "pending",
                "dependencies": [],
                "retryCount": 0,
                "createdAt": 1704067200000
            }
        ],
        "status": "planning",
        "currentTaskIndex": 0,
        "createdAt": 1704067200000,
        "correlationId": "test_corr_123",
        "metadata": {
            "complexityScore": 65,
            "complexityReasons": ["Contains complex patterns", "Multiple actions"],
            "estimatedTasks": 3,
            "actualTasks": 3
        }
    }

@pytest.fixture
def sample_complexity_analysis() -> Dict[str, Any]:
    """Análisis de complejidad de ejemplo"""
    return {
        "isComplex": True,
        "confidence": 0.85,
        "score": 75,
        "reasons": [
            "Contains 3 complex pattern(s)",
            "Long prompt (20 words)",
            "Multiple actions (3 verbs)",
            "Multiple components mentioned"
        ],
        "recommendedMode": "autonomous"
    }

@pytest.fixture
def sample_tool_schemas() -> list:
    """Esquemas de herramientas de ejemplo"""
    return [
        {
            "name": "file_manager",
            "description": "Create, read, write, delete files",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["read", "write", "delete"]},
                    "path": {"type": "string"},
                    "content": {"type": "string"}
                },
                "required": ["action", "path"]
            }
        },
        {
            "name": "code_executor",
            "description": "Execute Python, JavaScript, shell commands",
            "parameters": {
                "type": "object",
                "properties": {
                    "language": {"type": "string"},
                    "code": {"type": "string"},
                    "timeout": {"type": "number"}
                },
                "required": ["language", "code"]
            }
        },
        {
            "name": "web_search",
            "description": "Search internet for information",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "number"}
                },
                "required": ["query"]
            }
        }
    ]

@pytest.fixture
def sample_memory_entries() -> list:
    """Entradas de memoria de ejemplo"""
    return [
        {
            "id": "mem_1",
            "userId": "test_user",
            "content": "User prefers TypeScript over JavaScript",
            "metadata": {
                "type": "preference",
                "confidence": 0.95,
                "source": "conversation"
            },
            "timestamp": "2024-01-01T00:00:00Z"
        },
        {
            "id": "mem_2",
            "userId": "test_user",
            "content": "Project Charbi is an autonomous AI agent",
            "metadata": {
                "type": "fact",
                "confidence": 1.0,
                "source": "conversation"
            },
            "timestamp": "2024-01-01T01:00:00Z"
        }
    ]

# ═══════════════════════════════════════════════════════════════════════
# UTILIDADES DE TEST
# ═══════════════════════════════════════════════════════════════════════

@pytest.fixture
def event_loop():
    """Event loop para tests asíncronos"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
async def async_client():
    """Cliente HTTP asíncrono para tests"""
    import aiohttp
    async with aiohttp.ClientSession() as session:
        yield session

@pytest.fixture
def temp_file(tmp_path: Path) -> Path:
    """Archivo temporal para tests"""
    file = tmp_path / "test_file.txt"
    file.write_text("Test content")
    return file

@pytest.fixture
def temp_json_file(tmp_path: Path) -> Path:
    """Archivo JSON temporal para tests"""
    file = tmp_path / "test_file.json"
    file.write_text('{"key": "value"}')
    return file

# ═══════════════════════════════════════════════════════════════════════
# MARKERS PERSONALIZADOS
# ═══════════════════════════════════════════════════════════════════════

def pytest_configure(config):
    """Configurar markers personalizados"""
    config.addinivalue_line("markers", "unit: Unit tests (fast, isolated)")
    config.addinivalue_line("markers", "integration: Integration tests (multiple components)")
    config.addinivalue_line("markers", "e2e: End-to-end tests (full system)")
    config.addinivalue_line("markers", "slow: Tests that take more than 5 seconds")
    config.addinivalue_line("markers", "requires_kernel: Tests that require kernel running")
    config.addinivalue_line("markers", "requires_memory: Tests that require memory server")
    config.addinivalue_line("markers", "requires_llm: Tests that require LLM connection")
