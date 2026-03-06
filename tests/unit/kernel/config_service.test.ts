import fs from 'fs';
import yaml from 'js-yaml';
import { ConfigService, CONFIG_PATH } from '../../../kernel/config_service';

jest.mock('fs');
jest.mock('js-yaml');

describe('ConfigService', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;
  const mockedYaml = yaml as jest.Mocked<typeof yaml>;

  const mockConfig = {
    system: { name: 'Charbi', version: 2, mode: 'production' },
    provider: { name: 'gemini', enabled: true, model: 'gemini-pro', auth_type: 'api_key', endpoint: 'http://test' },
    models: { router: 'gemini-pro', fallback: 'gemini-1.5' },
    channels: { cli: { enabled: true } },
    skills: {},
    supervisor: { enabled: true, policy_file: 'policy.yaml', max_cpu_time: 1000, emergency_kill: false },
    runtime: { session_path: 'sessions', isolate_workspace: true }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance if possible or mock behavior
    // Since it's a singleton initialized on import, we might need to be careful
  });

  it('should load configuration correctly', () => {
    mockedFs.readFileSync.mockReturnValue('mock yaml content');
    mockedYaml.load.mockReturnValue(mockConfig);

    const configService = ConfigService.getInstance();
    const config = configService.load();

    expect(mockedFs.readFileSync).toHaveBeenCalledWith(CONFIG_PATH, 'utf8');
    expect(config).toEqual(mockConfig);
  });

  it('should return specific config sections', () => {
    const configService = ConfigService.getInstance();
    // Assuming load was called in previous test or here
    mockedYaml.load.mockReturnValue(mockConfig);
    configService.load();

    expect(configService.getSystem()).toEqual(mockConfig.system);
    expect(configService.getProvider()).toEqual(mockConfig.provider);
  });

  it('should support dot-notation access', () => {
    const configService = ConfigService.getInstance();
    mockedYaml.load.mockReturnValue(mockConfig);
    configService.load();

    expect(configService.get('system.name')).toBe('Charbi');
    expect(configService.get('provider.model')).toBe('gemini-pro');
  });
});
