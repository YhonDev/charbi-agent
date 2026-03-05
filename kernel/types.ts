// charbi/kernel/types.ts

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SessionState = 'IDLE' | 'PLANNING' | 'EXECUTING' | 'BLOCKED' | 'FAILED' | 'COMPLETED';

export interface ActionContext {
  id: string;
  sessionId: string;
  agent: string;
  timestamp: number;
}

export interface BaseAction {
  context: ActionContext;
}

export type FileReadAction = BaseAction & {
  type: 'filesystem.read';
  details: { path: string };
};

export type FileWriteAction = BaseAction & {
  type: 'filesystem.write';
  details: { path: string; content: string };
};

export type ShellExecAction = BaseAction & {
  type: 'shell.execute';
  details: { command: string };
};

export type NetworkAccessAction = BaseAction & {
  type: 'network.access';
  details: { dest: string; protocol?: string };
};

export type NetworkFetchAction = BaseAction & {
  type: 'network.fetch';
  details: { url: string; method: 'GET'; purpose: string; maxKB?: number };
};

/**
 * KernelAction
 * The formal contract for any action an agent attempts to execute.
 */
export type KernelAction =
  | FileReadAction
  | FileWriteAction
  | ShellExecAction
  | NetworkAccessAction
  | NetworkFetchAction;

export interface ActionResponse {
  success: boolean;
  data?: any;
  error?: string;
}
