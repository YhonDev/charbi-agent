#!/usr/bin/env python3
import time
import asyncio
import uuid
from typing import Dict, List, Callable, Any, Optional

class CircuitBreaker:
    def __init__(self, threshold: int = 5, timeout: int = 30):
        self.threshold = threshold
        self.timeout = timeout
        self.failures = 0
        self.lastFailureTime = 0
        self.state = 'CLOSED'

    def isOpen(self) -> bool:
        if self.state == 'OPEN':
            if time.time() - self.lastFailureTime > self.timeout:
                self.state = 'HALF_OPEN'
                return False
            return True
        return False

    def failure(self):
        self.failures += 1
        self.lastFailureTime = time.time()
        if self.failures >= self.threshold:
            self.state = 'OPEN'

    def success(self):
        self.failures = 0
        self.state = 'CLOSED'

class RateLimiter:
    def __init__(self, maxPerSecond: int = 1000):
        self.maxTokens = maxPerSecond
        self.tokens = maxPerSecond
        self.lastRefill = time.time()

    def refill(self):
        now = time.time()
        elapsed = now - self.lastRefill
        refill_amount = elapsed * self.maxTokens
        self.tokens = min(self.maxTokens, self.tokens + refill_amount)
        self.lastRefill = now

    def allow(self) -> bool:
        self.refill()
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False

class EventBus:
    def __init__(self):
        self.handlers: Dict[str, List[Callable]] = {}
        self.eventHistory: Dict[str, List[Dict]] = {}
        self.circuitBreaker = CircuitBreaker()
        self.rateLimiter = RateLimiter()
        self.max_history = 100

    def on(self, event_type: str, handler: Callable):
        if event_type not in self.handlers:
            self.handlers[event_type] = []
        self.handlers[event_type].append(handler)

    def onWithTimeout(self, event_type: str, handler: Callable, timeoutMs: int = 5000):
        async def wrap_handler(event):
            try:
                await asyncio.wait_for(handler(event), timeout=timeoutMs/1000.0)
            except asyncio.TimeoutError:
                pass
            except Exception:
                pass
        
        self.on(event_type, lambda e: asyncio.create_task(wrap_handler(e)))

    def removeListener(self, event_type: str, handler: Callable):
        if event_type in self.handlers:
            try:
                self.handlers[event_type].remove(handler)
            except ValueError:
                pass

    def emit(self, event: Dict[str, Any]) -> bool:
        if not event or 'type' not in event:
            raise KeyError("Event must have a 'type'")
        
        event_type = event['type']
        
        if self.circuitBreaker.isOpen():
            return False
        
        if not self.rateLimiter.allow():
            return True # Rate limited but not an error
        
        if 'correlationId' not in event:
            event['correlationId'] = f"evt_{uuid.uuid4().hex[:8]}"
            
        # Loop detection simple
        history = self.eventHistory.get(event_type, [])
        recent_count = sum(1 for e in history if e.get('correlationId') == event.get('correlationId'))
        if recent_count >= 3:
            return False

        # Add to history
        if event_type not in self.eventHistory:
            self.eventHistory[event_type] = []
        self.eventHistory[event_type].append(event)
        if len(self.eventHistory[event_type]) > self.max_history:
            self.eventHistory[event_type].pop(0)

        # Dispatch
        handlers = self.handlers.get(event_type, [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    asyncio.create_task(handler(event))
                else:
                    handler(event)
            except Exception:
                self.circuitBreaker.failure()
        
        return True

eventBus = EventBus()
