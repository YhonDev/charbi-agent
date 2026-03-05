// kernel/action_handlers.ts
// Ejecutores reales de acciones del kernel.
// Cada handler implementa una operación de bajo nivel controlada por el Supervisor.

import fs from 'fs';
import path from 'path';
import { execSync, exec } from 'child_process';
import https from 'https';
import http from 'http';

const CHARBI_HOME = process.env.CHARBI_HOME || path.join(require('os').homedir(), '.charbi-agent');
const SHELL_TIMEOUT_MS = 30000; // 30s max por comando
const MAX_OUTPUT_LENGTH = 4096; // Limitar output para no saturar el LLM

export interface ActionRequest {
  type: string;
  origin: string;
  params: any;
  permissions: string[];
}

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ─── Permission Check ───

const PERMISSION_MAP: Record<string, string> = {
  'filesystem.read': 'filesystem.read',
  'filesystem.write': 'filesystem.write',
  'filesystem.list': 'filesystem.read',
  'shell.execute': 'shell.execute',
  'network.fetch': 'network.access',
  'web.search': 'network.access',
};

function checkPermission(action: ActionRequest): boolean {
  const required = PERMISSION_MAP[action.type];
  if (!required) return false;
  return action.permissions.includes(required);
}

// ─── Handlers ───

async function handleFilesystemRead(params: any): Promise<ActionResult> {
  const filePath = params.path;
  if (!filePath) return { success: false, error: 'Missing path parameter' };

  try {
    if (fs.statSync(filePath).isDirectory()) {
      const entries = fs.readdirSync(filePath, { withFileTypes: true });
      const listing = entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
        size: e.isFile() ? fs.statSync(path.join(filePath, e.name)).size : undefined,
      }));
      return { success: true, data: { type: 'directory', entries: listing } };
    } else {
      const content = fs.readFileSync(filePath, 'utf8');
      const truncated = content.length > MAX_OUTPUT_LENGTH
        ? content.substring(0, MAX_OUTPUT_LENGTH) + '\n[...truncated]'
        : content;
      return { success: true, data: { type: 'file', content: truncated, size: content.length } };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function handleFilesystemWrite(params: any): Promise<ActionResult> {
  const filePath = params.path;
  const content = params.content;
  if (!filePath || content === undefined) return { success: false, error: 'Missing path or content' };

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true, data: { path: filePath, bytesWritten: Buffer.byteLength(content) } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function handleFilesystemList(params: any): Promise<ActionResult> {
  const dirPath = params.path || CHARBI_HOME;
  return handleFilesystemRead({ path: dirPath });
}

async function handleShellExecute(params: any): Promise<ActionResult> {
  const command = params.command;
  if (!command) return { success: false, error: 'Missing command parameter' };

  // Seguridad: bloquear comandos peligrosos
  const BLOCKED = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork bomb', '> /dev/sda'];
  for (const blocked of BLOCKED) {
    if (command.includes(blocked)) {
      return { success: false, error: 'Command blocked by security policy: ' + blocked };
    }
  }

  return new Promise((resolve) => {
    exec(command, { timeout: SHELL_TIMEOUT_MS, maxBuffer: 1024 * 1024, cwd: CHARBI_HOME }, (error, stdout, stderr) => {
      const output = (stdout || '').trim();
      const errOutput = (stderr || '').trim();
      const truncatedOutput = output.length > MAX_OUTPUT_LENGTH
        ? output.substring(0, MAX_OUTPUT_LENGTH) + '\n[...truncated]'
        : output;

      if (error) {
        resolve({
          success: false,
          error: error.message,
          data: { stdout: truncatedOutput, stderr: errOutput, exitCode: error.code }
        });
      } else {
        resolve({
          success: true,
          data: { stdout: truncatedOutput, stderr: errOutput, exitCode: 0 }
        });
      }
    });
  });
}

async function handleWebSearch(params: any): Promise<ActionResult> {
  const query = params.query;
  if (!query) return { success: false, error: 'Missing query parameter' };

  return new Promise((resolve) => {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };

    https.get(searchUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Simple regex extraction for top results (titles and links)
        const results: { title: string; link: string; snippet: string }[] = [];
        const regex = /<a class="result__a" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[\s\S]*?>([\s\S]*?)<\/a>/g;

        let match;
        while ((match = regex.exec(data)) !== null && results.length < 5) {
          results.push({
            title: match[2].replace(/<[^>]*>/g, '').trim(),
            link: match[1],
            snippet: match[3].replace(/<[^>]*>/g, '').trim()
          });
        }

        if (results.length === 0 && data.includes('No results')) {
          resolve({ success: true, data: { results: [], message: 'No se encontraron resultados.' } });
        } else {
          resolve({ success: true, data: { results } });
        }
      });
    }).on('error', e => resolve({ success: false, error: `Search error: ${e.message}` }));
  });
}

async function handleNetworkFetch(params: any): Promise<ActionResult> {
  const url = params.url;
  if (!url) return { success: false, error: 'Missing url parameter' };

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const transport = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        headers: { 'User-Agent': 'Charbi-Agent/1.0' },
        timeout: 10000
      };

      transport.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const truncated = data.length > MAX_OUTPUT_LENGTH
            ? data.substring(0, MAX_OUTPUT_LENGTH) + '\n[...truncated]'
            : data;
          resolve({ success: true, data: { status: res.statusCode, content: truncated } });
        });
      }).on('error', e => resolve({ success: false, error: `Fetch error: ${e.message}` }));
    } catch (e: any) {
      resolve({ success: false, error: `Invalid URL: ${e.message}` });
    }
  });
}

// ─── Router de acciones ───

const ACTION_HANDLERS: Record<string, (params: any) => Promise<ActionResult>> = {
  'filesystem.read': handleFilesystemRead,
  'filesystem.write': handleFilesystemWrite,
  'filesystem.list': handleFilesystemList,
  'shell.execute': handleShellExecute,
  'web.search': handleWebSearch,
  'network.fetch': handleNetworkFetch,
};

/**
 * executeAction — Punto de entrada principal.
 * Valida permisos y ejecuta el handler correspondiente.
 */
export async function executeAction(action: ActionRequest): Promise<ActionResult> {
  console.log(`[ActionHandler] Executing: ${action.type} from ${action.origin}`);

  // 1. Verificar que el handler existe
  const handler = ACTION_HANDLERS[action.type];
  if (!handler) {
    return { success: false, error: `Unknown action type: ${action.type}` };
  }

  // 2. Verificar permisos
  if (!checkPermission(action)) {
    const required = PERMISSION_MAP[action.type] || 'unknown';
    console.warn(`[ActionHandler] [SECURITY] Permission denied for ${action.type}. Origin: ${action.origin}. Required: ${required}`);
    return {
      success: false,
      error: `Permission denied: Origin '${action.origin}' lacks required permission '${required}' for action '${action.type}'`
    };
  }

  // 3. Ejecutar
  try {
    const result = await handler(action.params);
    console.log(`[ActionHandler] ${action.type}: ${result.success ? 'OK' : 'FAIL'}`);
    return result;
  } catch (e: any) {
    return { success: false, error: `Handler error: ${e.message}` };
  }
}

/** Lista las herramientas disponibles (para el LLM) */
export function getAvailableTools(): { name: string; description: string; params: string[] }[] {
  return [
    { name: 'filesystem.read', description: 'Leer un archivo o listar un directorio', params: ['path'] },
    { name: 'filesystem.write', description: 'Escribir contenido a un archivo', params: ['path', 'content'] },
    { name: 'filesystem.list', description: 'Listar contenido de un directorio', params: ['path'] },
    { name: 'shell.execute', description: 'Ejecutar un comando en bash', params: ['command'] },
    { name: 'web.search', description: 'Buscar en la web (DuckDuckGo)', params: ['query'] },
    { name: 'network.fetch', description: 'Hacer GET a una URL y obtener el contenido', params: ['url'] },
  ];
}

export default { executeAction, getAvailableTools };
