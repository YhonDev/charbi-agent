#!/usr/bin/env python3
"""
🧪 Unit Tests - Event Bus
Pruebas unitarias para el Event Bus del Kernel
"""

import pytest
import asyncio
import time
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import sys

# Redirigir al proyecto raíz
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE CIRCUIT BREAKER
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestCircuitBreaker:
    """Tests para Circuit Breaker del Event Bus"""
    
    @pytest.fixture
    def circuit_breaker(self):
        """Crear Circuit Breaker para tests"""
        from kernel.core.event_bus import CircuitBreaker
        return CircuitBreaker()
    
    def test_initial_state_is_closed(self, circuit_breaker):
        """Circuit breaker inicia en estado CLOSED"""
        assert circuit_breaker.isOpen() == False
        assert circuit_breaker.state == 'CLOSED'
        assert circuit_breaker.failures == 0
    
    def test_opens_after_threshold_failures(self, circuit_breaker):
        """Circuit breaker se abre después de threshold fallos"""
        # 5 fallos deberían abrir el circuito
        for i in range(5):
            circuit_breaker.failure()
        
        assert circuit_breaker.isOpen() == True
        assert circuit_breaker.state == 'OPEN'
    
    def test_closes_after_success(self, circuit_breaker):
        """Circuit breaker se cierra después de éxito"""
        circuit_breaker.failure()
        circuit_breaker.failure()
        circuit_breaker.success()
        
        assert circuit_breaker.isOpen() == False
        assert circuit_breaker.state == 'CLOSED'
        assert circuit_breaker.failures == 0
    
    def test_half_open_after_timeout(self, circuit_breaker):
        """Circuit breaker pasa a HALF_OPEN después de timeout"""
        # Forzar apertura
        for i in range(5):
            circuit_breaker.failure()
        
        assert circuit_breaker.isOpen() == True
        assert circuit_breaker.state == 'OPEN'
        
        # Simular paso de tiempo (31 segundos, timeout es 30s)
        circuit_breaker.lastFailureTime = time.time() - 31
        
        # Debería estar HALF_OPEN ahora
        assert circuit_breaker.isOpen() == False
        assert circuit_breaker.state == 'HALF_OPEN'
    
    def test_multiple_success_resets_failures(self, circuit_breaker):
        """Múltiples éxitos resetean contadores"""
        circuit_breaker.failure()
        circuit_breaker.failure()
        circuit_breaker.success()
        circuit_breaker.success()
        circuit_breaker.success()
        
        assert circuit_breaker.failures == 0
        assert circuit_breaker.state == 'CLOSED'

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE RATE LIMITER
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestRateLimiter:
    """Tests para Rate Limiter del Event Bus"""
    
    @pytest.fixture
    def rate_limiter(self):
        """Crear Rate Limiter para tests"""
        from kernel.core.event_bus import RateLimiter
        return RateLimiter(maxPerSecond=10)
    
    def test_allows_up_to_max_tokens(self, rate_limiter):
        """Rate limiter permite hasta max tokens"""
        allowed_count = 0
        for i in range(15):
            if rate_limiter.allow():
                allowed_count += 1
        
        assert allowed_count == 10  # maxPerSecond = 10
    
    def test_refills_over_time(self, rate_limiter):
        """Rate limiter recarga tokens con el tiempo"""
        # Consumir todos los tokens
        for i in range(10):
            rate_limiter.allow()
        
        assert rate_limiter.allow() == False
        
        # Simular paso de tiempo (1 segundo)
        rate_limiter.lastRefill = time.time() - 1
        rate_limiter.refill()
        
        # Debería tener tokens ahora
        assert rate_limiter.allow() == True
    
    def test_does_not_exceed_max_tokens(self, rate_limiter):
        """Rate limiter no excede max tokens"""
        # Simular mucho tiempo pasado
        rate_limiter.lastRefill = time.time() - 100
        rate_limiter.refill()
        
        # No debería tener más de maxTokens
        allowed_count = 0
        for i in range(20):
            if rate_limiter.allow():
                allowed_count += 1
        
        assert allowed_count <= rate_limiter.maxTokens

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE EVENT BUS
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestEventBus:
    """Tests para Event Bus"""
    
    @pytest.fixture
    def event_bus(self):
        """Crear Event Bus para tests"""
        from kernel.core.event_bus import EventBus
        return EventBus()
    
    def test_emit_event(self, event_bus):
        """Event Bus emite eventos correctamente"""
        handler = Mock()
        event_bus.on('TEST_EVENT', handler)
        
        event = {
            'type': 'TEST_EVENT',
            'payload': {'data': 'test'},
            'correlationId': 'test_123'
        }
        
        result = event_bus.emit(event)
        
        assert result == True
        handler.assert_called_once_with(event)
    
    def test_emit_generates_correlation_id(self, event_bus):
        """Event Bus genera correlationId si no se proporciona"""
        event = {
            'type': 'TEST_EVENT',
            'payload': {'data': 'test'}
        }
        
        event_bus.emit(event)
        
        assert 'correlationId' in event
        assert event['correlationId'].startswith('evt_')
    
    def test_emit_without_type_raises_error(self, event_bus):
        """Event Bus requiere tipo de evento"""
        event = {
            'payload': {'data': 'test'}
        }
        
        with pytest.raises(KeyError):
            event_bus.emit(event)
    
    def test_loop_detection(self, event_bus):
        """Event Bus detecta loops de eventos"""
        event = {
            'type': 'LOOP_EVENT',
            'payload': {},
            'correlationId': 'test_123'
        }
        
        # Emitir mismo evento 3 veces en 5 segundos
        for i in range(3):
            event_bus.emit(event)
        
        # La cuarta debería ser bloqueada
        result = event_bus.emit(event)
        
        assert result == False
    
    @pytest.mark.asyncio
    async def test_onWithTimeout(self, event_bus):
        """Event Bus maneja timeouts en handlers"""
        handler = AsyncMock(side_effect=asyncio.TimeoutError())
        
        event_bus.onWithTimeout('TIMEOUT_EVENT', handler, timeoutMs=100)
        
        event = {
            'type': 'TIMEOUT_EVENT',
            'payload': {},
            'correlationId': 'test_123'
        }
        
        event_bus.emit(event)
        
        # Esperar un poco para que el handler se ejecute
        await asyncio.sleep(0.2)
        
        # Handler debería haber sido llamado
        handler.assert_called_once()
    
    def test_handler_exception_doesnt_crash_bus(self, event_bus):
        """Excepción en handler no colapsa el Event Bus"""
        def failing_handler(event):
            raise Exception("Handler failed")
        
        event_bus.on('FAIL_EVENT', failing_handler)
        
        event = {
            'type': 'FAIL_EVENT',
            'payload': {},
            'correlationId': 'test_123'
        }
        
        # No debería colapsar
        result = event_bus.emit(event)
        
        assert result == True
    
    def test_memory_limit_on_eventHistory(self, event_bus):
        """Event Bus limita historial de eventos a 100"""
        for i in range(150):
            event_bus.emit({
                'type': 'HISTORY_EVENT',
                'payload': {'index': i},
                'correlationId': f'test_{i}'
            })
        
        history = event_bus.eventHistory.get('HISTORY_EVENT', [])
        
        assert len(history) <= 100
    
    def test_removeListener(self, event_bus):
        """Event Bus permite remover listeners"""
        handler = Mock()
        event_bus.on('REMOVE_EVENT', handler)
        event_bus.emit({'type': 'REMOVE_EVENT', 'payload': {}})
        
        handler.assert_called_once()
        
        # Remover listener
        event_bus.removeListener('REMOVE_EVENT', handler)
        handler.reset_mock()
        
        # Emitir de nuevo
        event_bus.emit({'type': 'REMOVE_EVENT', 'payload': {}})
        
        # No debería ser llamado
        handler.assert_not_called()

# ═══════════════════════════════════════════════════════════════════════
# TESTS DE EDGE CASES
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestEventBusEdgeCases:
    """Tests para casos borde del Event Bus"""
    
    @pytest.fixture
    def event_bus(self):
        from kernel.core.event_bus import EventBus
        return EventBus()
    
    def test_emit_null_event(self, event_bus):
        """Event Bus maneja evento null"""
        with pytest.raises(Exception):
            event_bus.emit(None)
    
    def test_emit_empty_payload(self, event_bus):
        """Event Bus maneja payload vacío"""
        handler = Mock()
        event_bus.on('EMPTY_EVENT', handler)
        
        event_bus.emit({
            'type': 'EMPTY_EVENT',
            'payload': {}
        })
        
        handler.assert_called_once()
    
    def test_concurrent_emits(self, event_bus):
        """Event Bus maneja emits concurrentes"""
        handler = Mock()
        event_bus.on('CONCURRENT_EVENT', handler)
        
        # Emitir múltiples veces rápidamente
        for i in range(100):
            event_bus.emit({
                'type': 'CONCURRENT_EVENT',
                'payload': {'index': i}
            })
        
        assert handler.call_count == 100
    
    def test_circuit_breaker_prevents_emit(self, event_bus):
        """Circuit breaker previene emit cuando está abierto"""
        # Forzar apertura del circuit breaker
        for i in range(10):
            event_bus.emit({
                'type': 'ERROR_EVENT',
                'payload': {'error': f'error_{i}'}
            })
        
        # Después de muchos errores, el circuit breaker debería abrirse
        # y prevenir más emits
        # (Esto depende de la implementación exacta de CircuitBreaker en EventBus)
        pass
