#!/usr/bin/env python3
"""
🧪 Unit Tests - Intelligence Proxy
Pruebas unitarias para el IntelligenceProxy (Gatekeeper del LLM)
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import sys

# Redirigir al proyecto raíz
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE FILTRADO DE CONTEXTO
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestContextFiltering:
    """Tests para filtrado de contexto"""
    
    @pytest.fixture
    def intelligence_proxy(self):
        from kernel.core.intelligence_proxy import IntelligenceProxy
        mock_connector = AsyncMock()
        return IntelligenceProxy(mock_connector)
    
    def test_sanitizePrompt_removes_passwords(self, intelligence_proxy):
        """sanitizePrompt elimina contraseñas"""
        prompt = "My password is secret123 and API key is abc123"
        
        sanitized = intelligence_proxy.sanitizePrompt(prompt)
        
        assert 'secret123' not in sanitized
        assert 'abc123' not in sanitized
        assert '[REDACTED]' in sanitized
    
    def test_sanitizePrompt_removes_api_keys(self, intelligence_proxy):
        """sanitizePrompt elimina API keys"""
        prompt = "Use API key: sk-1234567890abcdef"
        
        sanitized = intelligence_proxy.sanitizePrompt(prompt)
        
        assert 'sk-1234567890abcdef' not in sanitized
        assert '[REDACTED]' in sanitized
    
    def test_filterContext_limits_tokens(self, intelligence_proxy):
        """filterContext limita tokens del contexto"""
        context = [{'content': 'x' * 1000} for _ in range(20)]
        
        filtered = intelligence_proxy.filterContext(context, {'maxTokens': 5000})
        
        assert len(filtered) < 20
    
    def test_filterContext_removes_sensitive_data(self, intelligence_proxy):
        """filterContext remueve datos sensibles"""
        context = [
            {'role': 'user', 'content': 'My password is 123456'},
            {'role': 'assistant', 'content': 'I understand'}
        ]
        
        filtered = intelligence_proxy.filterContext(context, {'removeSensitive': True})
        
        assert '123456' not in str(filtered)

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE SELECCIÓN DE HERRAMIENTAS
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestToolSelection:
    """Tests para selección de herramientas"""
    
    @pytest.fixture
    def intelligence_proxy(self):
        from kernel.core.intelligence_proxy import IntelligenceProxy
        mock_connector = AsyncMock()
        return IntelligenceProxy(mock_connector)
    
    def test_selectToolsForLLM_chat_mode(self, intelligence_proxy):
        """selectToolsForLLM en modo chat limita herramientas"""
        all_tools = [
            {'name': 'memory_read'},
            {'name': 'web_search'},
            {'name': 'file_manager'},
            {'name': 'code_executor'}
        ]
        
        allowed = intelligence_proxy.selectToolsForLLM(all_tools, mode='chat')
        
        allowed_names = [t['name'] for t in allowed]
        assert 'file_manager' not in allowed_names
        assert 'code_executor' not in allowed_names
    
    def test_selectToolsForLLM_autonomous_mode(self, intelligence_proxy):
        """selectToolsForLLM en modo autónomo permite más herramientas"""
        all_tools = [
            {'name': 'memory_read'},
            {'name': 'file_manager'},
            {'name': 'code_executor'}
        ]
        
        with patch.object(intelligence_proxy.permissionChecker, 'canUseTool', return_value=True):
            allowed = intelligence_proxy.selectToolsForLLM(all_tools, mode='autonomous')
        
        assert len(allowed) > 0

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE VALIDACIÓN DE TOOL CALLS
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestToolCallValidation:
    """Tests para validación de tool calls"""
    
    @pytest.fixture
    def intelligence_proxy(self):
        from kernel.core.intelligence_proxy import IntelligenceProxy
        mock_connector = AsyncMock()
        return IntelligenceProxy(mock_connector)
    
    @pytest.mark.asyncio
    async def test_validateToolCalls_rejects_unknown_tool(self, intelligence_proxy):
        """validateToolCalls rechaza herramienta desconocida"""
        tool_calls = [
            {'name': 'unknown_tool', 'arguments': {}, 'id': 'call_1'}
        ]
        
        with patch.object(intelligence_proxy.permissionChecker, 'toolExists', return_value=False):
            validated = await intelligence_proxy.validateToolCalls(tool_calls)
        
        assert len(validated) == 0
    
    @pytest.mark.asyncio
    async def test_validateToolCalls_rejects_unpermitted_tool(self, intelligence_proxy):
        """validateToolCalls rechaza herramienta sin permiso"""
        tool_calls = [
            {'name': 'shell_command', 'arguments': {}, 'id': 'call_1'}
        ]
        
        with patch.object(intelligence_proxy.permissionChecker, 'toolExists', return_value=True):
            with patch.object(intelligence_proxy.permissionChecker, 'canUseTool', return_value=False):
                validated = await intelligence_proxy.validateToolCalls(tool_calls)
        
        assert len(validated) == 0
    
    @pytest.mark.asyncio
    async def test_validateToolCalls_rejects_dangerous_args(self, intelligence_proxy):
        """validateToolCalls rechaza argumentos peligrosos"""
        tool_calls = [
            {'name': 'shell_command', 'arguments': {'command': 'rm -rf /'}, 'id': 'call_1'}
        ]
        
        with patch.object(intelligence_proxy.permissionChecker, 'toolExists', return_value=True):
            with patch.object(intelligence_proxy.permissionChecker, 'canUseTool', return_value=True):
                with patch.object(intelligence_proxy.jsonValidator, 'validate', return_value=True):
                    validated = await intelligence_proxy.validateToolCalls(tool_calls)
        
        assert len(validated) == 0
    
    @pytest.mark.asyncio
    async def test_validateToolCalls_accepts_valid_calls(self, intelligence_proxy):
        """validateToolCalls acepta tool calls válidos"""
        tool_calls = [
            {'name': 'file_manager', 'arguments': {'action': 'write', 'path': '/tmp/test.txt'}, 'id': 'call_1'}
        ]
        
        with patch.object(intelligence_proxy.permissionChecker, 'toolExists', return_value=True):
            with patch.object(intelligence_proxy.permissionChecker, 'canUseTool', return_value=True):
                with patch.object(intelligence_proxy.jsonValidator, 'validate', return_value=True):
                    validated = await intelligence_proxy.validateToolCalls(tool_calls)
        
        assert len(validated) == 1
        assert validated[0]['name'] == 'file_manager'

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE PROCESAMIENTO COMPLETO
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestIntelligenceProxyProcess:
    """Tests para procesamiento completo del Proxy"""
    
    @pytest.fixture
    def intelligence_proxy(self):
        from kernel.core.intelligence_proxy import IntelligenceProxy
        mock_connector = AsyncMock()
        mock_connector.generate.return_value = {
            'content': 'Test response',
            'toolCalls': []
        }
        return IntelligenceProxy(mock_connector)
    
    @pytest.mark.asyncio
    async def test_process_filters_context_before_sending(self, intelligence_proxy):
        """process filtra contexto antes de enviar al LLM"""
        request = {
            'prompt': 'Test prompt',
            'context': [{'content': 'Sensitive: password123'}],
            'mode': 'chat'
        }
        
        with patch.object(intelligence_proxy, 'filterContext') as mock_filter:
            mock_filter.return_value = []
            with patch.object(intelligence_proxy, 'sanitizePrompt', return_value='Test prompt'):
                with patch.object(intelligence_proxy, 'selectToolsForLLM', return_value=[]):
                    with patch.object(intelligence_proxy, 'validateToolCalls', return_value=[]):
                        await intelligence_proxy.process(request)
        
        mock_filter.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_process_validates_tool_calls_before_executing(self, intelligence_proxy):
        """process valida tool calls antes de ejecutar"""
        request = {
            'prompt': 'Test prompt',
            'context': [],
            'mode': 'autonomous',
            'availableTools': []
        }
        
        with patch.object(intelligence_proxy, 'filterContext', return_value=[]):
            with patch.object(intelligence_proxy, 'sanitizePrompt', return_value='Test prompt'):
                with patch.object(intelligence_proxy, 'selectToolsForLLM', return_value=[]):
                    with patch.object(intelligence_proxy.connector, 'generate') as mock_generate:
                        mock_generate.return_value = {
                            'content': 'Test',
                            'toolCalls': [{'name': 'test', 'arguments': {}}]
                        }
                        with patch.object(intelligence_proxy, 'validateToolCalls') as mock_validate:
                            mock_validate.return_value = []
                            await intelligence_proxy.process(request)
        
        mock_validate.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_process_logs_audit(self, intelligence_proxy):
        """process loguea auditoría"""
        request = {
            'prompt': 'Test prompt',
            'context': [],
            'mode': 'chat'
        }
        
        with patch.object(intelligence_proxy, 'filterContext', return_value=[]):
            with patch.object(intelligence_proxy, 'sanitizePrompt', return_value='Test prompt'):
                with patch.object(intelligence_proxy, 'selectToolsForLLM', return_value=[]):
                    with patch.object(intelligence_proxy.connector, 'generate', return_value={'content': 'Test', 'toolCalls': []}):
                        with patch.object(intelligence_proxy, 'validateToolCalls', return_value=[]):
                            with patch.object(intelligence_proxy, 'logAudit') as mock_audit:
                                await intelligence_proxy.process(request)
        
        mock_audit.assert_called_once()
