import { eventBus, emitEvent, EventType } from '../../kernel/event_bus';
import { registerGoal, getGoal } from '../../kernel/goal_engine';
import { log } from '../../kernel/logger';
import fs from 'fs';

jest.mock('fs');
jest.mock('../../kernel/logger');

describe('Kernel Integration Flow', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({
      schemaVersion: 1,
      goals: [],
      lastModified: Date.now()
    }));
  });

  it('should handle a full cycle: Goal Registration -> Event Emission', (done) => {
    // 1. Register a goal
    const goal = registerGoal({
      objective: 'Integration Test Goal',
      agent: 'test-agent'
    });

    expect(goal.id).toBeDefined();

    // 2. Setup listener for an event that might be triggered
    eventBus.once(EventType.AGENT_THINK, (event) => {
      expect(event.payload.goalId).toBe(goal.id);
      done();
    });

    // 3. Emit event (simulating some trigger)
    emitEvent({
      id: 'evt-123',
      type: EventType.AGENT_THINK,
      timestamp: Date.now(),
      payload: { goalId: goal.id }
    });
  });
});
