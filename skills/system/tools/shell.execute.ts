// skills/system/tools/shell.execute.ts
import { CharbiTool } from '../../../kernel/tool_interface';
import { exec } from 'child_process';
import path from 'path';

const SHELL_TIMEOUT_MS = 30000;
const MAX_OUTPUT_LENGTH = 4096;
const CHARBI_HOME = process.env.CHARBI_HOME || path.join(require('os').homedir(), '.charbi-agent');

const tool: CharbiTool = {
  schema: {
    name: 'execute',
    description: 'Ejecuta un comando en la terminal bash del sistema de forma segura.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'El comando de terminal a ejecutar (ej: ls, ps, cat).'
        }
      },
      required: ['command']
    }
  },
  handler: async (params: any) => {
    const { command } = params;

    // Seguridad: bloquear comandos peligrosos
    const BLOCKED = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork bomb', '> /dev/sda', 'reboot', 'shutdown'];
    for (const blocked of BLOCKED) {
      if (command.includes(blocked)) {
        throw new Error('Comando bloqueado por política de seguridad: ' + blocked);
      }
    }

    return new Promise((resolve, reject) => {
      // Use the user's home directory as the default working directory
      const defaultCwd = process.env.HOME || require('os').homedir();

      exec(command, {
        timeout: SHELL_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        cwd: defaultCwd
      }, (error, stdout, stderr) => {
        const output = (stdout || '').trim();
        const errOutput = (stderr || '').trim();

        const truncatedOutput = output.length > MAX_OUTPUT_LENGTH
          ? output.substring(0, MAX_OUTPUT_LENGTH) + '\n[...truncated]'
          : output;

        if (error) {
          resolve({
            success: false,
            error: error.message,
            stdout: truncatedOutput,
            stderr: errOutput,
            exitCode: error.code
          });
        } else {
          resolve({
            success: true,
            stdout: truncatedOutput,
            stderr: errOutput,
            exitCode: 0
          });
        }
      });
    });
  }
};

export default tool;
