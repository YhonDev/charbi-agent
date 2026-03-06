import fs from 'fs';
import { registerGoal, updateGoalStatus, getPendingGoals, Goal } from '../../../kernel/goal_engine';

jest.mock('fs');
jest.mock('../../../kernel/logger');
jest.mock('../../../kernel/journal');

describe('GoalEngine', () => {
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

  it('should register a goal correctly', () => {
    const goal = registerGoal({
      objective: 'Test Objective',
      agent: 'test-agent'
    });

    expect(goal.objective).toBe('Test Objective');
    expect(goal.agent).toBe('test-agent');
    expect(goal.status).toBe('pending');
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });

  it('should update goal status', () => {
    const mockGoal: Goal = {
      id: 'goal-123',
      schemaVersion: 1,
      objective: 'Test',
      agent: 'agent',
      status: 'pending',
      priority: 5,
      checkpoints: [],
      lastStepId: null,
      dependencies: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {},
      hash: 'old-hash'
    };

    mockedFs.readFileSync.mockReturnValue(JSON.stringify({
      schemaVersion: 1,
      goals: [mockGoal],
      lastModified: Date.now()
    }));

    const updated = updateGoalStatus('goal-123', 'running');

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('running');
    expect(updated?.hash).not.toBe('old-hash');
  });

  it('should return pending goals with met dependencies', () => {
    const goal1: Goal = {
      id: 'goal-1', status: 'completed', dependencies: [],
      schemaVersion: 1, objective: 'O1', agent: 'A1', priority: 5, checkpoints: [], lastStepId: null, createdAt: 0, updatedAt: 0, metadata: {}, hash: 'h1'
    };
    const goal2: Goal = {
      id: 'goal-2', status: 'pending', dependencies: ['goal-1'],
      schemaVersion: 1, objective: 'O2', agent: 'A2', priority: 1, checkpoints: [], lastStepId: null, createdAt: 0, updatedAt: 0, metadata: {}, hash: 'h2'
    };

    mockedFs.readFileSync.mockReturnValue(JSON.stringify({
      schemaVersion: 1,
      goals: [goal1, goal2],
      lastModified: Date.now()
    }));

    const pending = getPendingGoals();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe('goal-2');
  });
});
