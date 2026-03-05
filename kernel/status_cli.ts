// kernel/status_cli.ts
// Script puente para exportar el estado del sistema en JSON para la CLI.

import { StatusService } from './services/status_service';

async function main() {
  try {
    const status = await StatusService.getFullStatus();
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  } catch (e: any) {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
  }
}

main();
