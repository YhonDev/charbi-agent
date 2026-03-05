// kernel/cognition/memory_client.ts
// Cliente RPC para comunicarse con el servidor de memoria en Python.

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export class MemoryClient {
  private process: ChildProcess | null = null;
  private charbiHome: string;
  private requestId: number = 0;
  private pendingRequests: Map<number, (res: any) => void> = new Map();

  constructor() {
    this.charbiHome = process.env.CHARBI_HOME || path.join(require('os').homedir(), '.charbi-agent');
    this.init();
  }

  private init() {
    const venvPython = path.join(this.charbiHome, 'cli', 'venv', 'bin', 'python');

    console.log('[MemoryClient] Inciando MemoryServer (Python Lite)...');

    this.process = spawn(venvPython, ['-m', 'memory.memory_server'], {
      cwd: this.charbiHome,
      env: process.env
    });

    this.process.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);
          if (response.id !== undefined && this.pendingRequests.has(response.id)) {
            const resolve = this.pendingRequests.get(response.id);
            resolve!(response);
            this.pendingRequests.delete(response.id);
          }
        } catch (e) {
          console.error('[MemoryClient] Error parsing response:', line, e);
        }
      }
    });

    this.process.stderr?.on('data', (data) => {
      console.error('[MemoryServer-LOG]', data.toString());
    });

    this.process.on('close', (code) => {
      console.warn(`[MemoryClient] MemoryServer cerrado con código ${code}. Reiniciando en 5s...`);
      setTimeout(() => this.init(), 5000);
    });
  }

  async call(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = JSON.stringify({ id, method, params }) + '\n';

      this.pendingRequests.set(id, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response.result);
      });

      if (this.process?.stdin?.writable) {
        this.process.stdin.write(request);
      } else {
        this.pendingRequests.delete(id);
        reject(new Error('MemoryServer no está disponible (stdin not writable)'));
      }
    });
  }
}

export const memoryClient = new MemoryClient();
export default memoryClient;
