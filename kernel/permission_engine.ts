// charbi/kernel/permission_engine.ts
export type PermissionProfile = Record<string, boolean>;

/**
 * permissionEngine
 * Validates if a specific profile has the required permissions for an action.
 */
export function validatePermissions(profile: PermissionProfile, action: string): boolean {
  // Action examples: filesystem.write, shell.execute, network.access, telegram.send
  return !!profile[action];
}
