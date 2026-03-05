// kernel/auth_cli.ts
// Punto de entrada para comandos de autenticación desde la CLI.

import { AuthManager } from './auth/auth_manager';

async function main() {
  const args = process.argv.slice(2);
  const provider = args[0];
  const command = args[1];

  if (!provider) {
    console.log('Uso: npx ts-node kernel/auth_cli.ts <provider> [login|status|key <value>]');
    process.exit(1);
  }

  try {
    if (command === 'key' && args[2]) {
      AuthManager.saveApiKey(provider, args[2]);
      process.exit(0);
    } else if (command === 'status') {
      const status = AuthManager.listAuthStatus();
      console.log(JSON.stringify(status, null, 2));
      process.exit(0);
    } else {
      // Por defecto intentar login (interactivo si es soportado)
      await AuthManager.login(provider);
      process.exit(0);
    }
  } catch (e: any) {
    console.error(`[AuthCLI] Error: ${e.message}`);
    process.exit(1);
  }
}

main();
