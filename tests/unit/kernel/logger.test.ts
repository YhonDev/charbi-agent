import fs from 'fs';
import { log, recordMetric, metrics } from '../../../kernel/logger';

jest.mock('fs');

describe('Logger', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset metrics
    metrics.toolCalls = 0;
    metrics.blocks = 0;
    metrics.escalations = 0;
    metrics.sessions = 0;
  });

  it('should log messages to the console and file', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    log({
      level: 'INFO',
      module: 'TestModule',
      message: 'Test message'
    });

    expect(consoleSpy).toHaveBeenCalled();
    expect(mockedFs.appendFileSync).toHaveBeenCalled();

    const callArgs = mockedFs.appendFileSync.mock.calls[0];
    const loggedData = JSON.parse(callArgs[1] as string);

    expect(loggedData.level).toBe('INFO');
    expect(loggedData.module).toBe('TestModule');
    expect(loggedData.message).toBe('Test message');

    consoleSpy.mockRestore();
  });

  it('should record metrics correctly', () => {
    recordMetric('toolCalls');
    recordMetric('toolCalls');
    recordMetric('blocks');

    expect(metrics.toolCalls).toBe(2);
    expect(metrics.blocks).toBe(1);
    expect(metrics.escalations).toBe(0);
  });
});
