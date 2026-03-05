// kernel/action_handlers.ts
// Router de acciones que delega la ejecución al ToolRegistry.

import { toolRegistry } from './tool_registry';

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

// Mapeo detallado de permisos por herramienta
const PERMISSION_MAP: Record<string, string> = {
  'system.read': 'filesystem.read',
  'system.write': 'filesystem.write',
  'system.list': 'filesystem.read',
  'system.execute': 'shell.execute',
  'system.search': 'network.access',
  'system.fetch': 'network.access',
  'cognitive.store': 'filesystem.write',
  'cognitive.search': 'filesystem.read',
};

function checkPermission(action: ActionRequest): boolean {
  const required = PERMISSION_MAP[action.type];
  if (!required) return false;
  return action.permissions.includes(required);
}

// ─── Entry Point ───

/**
 * executeAction — Punto de entrada principal.
 * Valida permisos y ejecuta el handler correspondiente de la herramienta.
 */
export async function executeAction(action: ActionRequest): Promise<ActionResult> {
  console.log(`[ActionHandler] Executing: ${action.type} from ${action.origin}`);

  // 1. Verificar que la herramienta existe en el registro
  const tool = toolRegistry.getTool(action.type);
  if (!tool) {
    return { success: false, error: `Herramienta no encontrada o no cargada: ${action.type}` };
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

  // 3. Ejecutar el handler de la herramienta
  try {
    const data = await tool.handler(action.params);
    const success = data.success !== undefined ? data.success : true;
    console.log(`[ActionHandler] ${action.type}: ${success ? 'OK' : 'FAIL'}`);
    return { success, data };
  } catch (e: any) {
    console.error(`[ActionHandler] Error ejecutando ${action.type}:`, e.message);
    return { success: false, error: e.message };
  }
}

/** Lista las herramientas disponibles (schemas) para el LLM */
export function getAvailableTools(): any[] {
  return toolRegistry.getAllSchemas();
}

export default { executeAction, getAvailableTools };
