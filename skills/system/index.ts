// skills/system/index.ts
// Core Skill — Herramientas del sistema por defecto.
// Esta skill expone filesystem y shell al kernel como herramientas invocables.

import { executeAction, getAvailableTools, ActionRequest } from '../../kernel/action_handlers';

/**
 * run — Entry point para la skill de sistema.
 * Ejecuta una acción directamente a través del ActionHandler del kernel.
 */
export async function run(ctx: any, params: any) {
  const actionType = params.action || params.type;
  if (!actionType) {
    return { error: 'Missing action type. Available: ' + getAvailableTools().map(t => t.name).join(', ') };
  }

  const request: ActionRequest = {
    type: actionType,
    origin: 'skill:system',
    params: params.params || params,
    permissions: ['filesystem.read', 'filesystem.write', 'shell.execute', 'network.access'],
  };

  return executeAction(request);
}

/** Lista herramientas disponibles */
export function listTools() {
  return getAvailableTools();
}

export default { run, listTools };
