// charbi/kernel/config_loader.ts
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface CharbiConfig {
  system: {
    name: string;
    version: number;
    mode: 'development' | 'production' | 'safe';
  };
  models: {
    router: string;
    fallback: string;
  };
  supervisor: {
    enabled: boolean;
    policy_file: string;
    max_cpu_time: number;
    max_tool_calls?: number;
    emergency_kill: boolean;
  };
  runtime: {
    session_path: string;
    isolate_workspace: boolean;
    autonomy?: boolean;
    maxDepth?: number;
  };
  channels: {
    telegram: {
      enabled: boolean;
      token_env: string;
    };
  };
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'charbi-agent.yaml');

/**
 * loadConfig
 * Loads and parses the central YAML configuration.
 */
export function loadConfig(): CharbiConfig {
  try {
    const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
    return yaml.load(fileContents) as CharbiConfig;
  } catch (e) {
    console.error(`[Kernel] Failed to load config from ${CONFIG_PATH}: ${e}`);
    throw e;
  }
}

/**
 * updateConfig
 * Partially updates the YAML configuration and saves it to disk.
 */
export function updateConfig(updates: Partial<CharbiConfig>): void {
  const current = loadConfig();
  const merged = { ...current, ...updates };
  fs.writeFileSync(CONFIG_PATH, yaml.dump(merged), 'utf8');
  console.log(`[Kernel] Configuration updated successfully.`);
}

export default loadConfig;
