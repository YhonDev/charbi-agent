import { eventBus, emitEvent, EventType, KernelEvent } from '../../../kernel/event_bus';

describe('EventBus', () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  it('should emit and receive events', (done) => {
    const testEvent: KernelEvent = {
      id: 'test-id',
      type: EventType.USER_REQUEST,
      timestamp: Date.now(),
      payload: { query: 'hello' }
    };

    eventBus.once(EventType.USER_REQUEST, (event) => {
      expect(event).toEqual(testEvent);
      done();
    });

    emitEvent(testEvent);
  });

  it('should support custom event types', (done) => {
    const customType = 'custom.event';
    const testEvent: KernelEvent = {
      id: 'test-id',
      type: customType,
      timestamp: Date.now()
    };

    eventBus.once(customType, (event) => {
      expect(event.type).toBe(customType);
      done();
    });

    emitEvent(testEvent);
  });
});
