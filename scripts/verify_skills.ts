// scripts/verify_skills.ts
import { toolRegistry } from '../kernel/tool_registry';
import { ActionRequest, executeAction } from '../kernel/action_handlers';

async function verify() {
  console.log('--- AUDITORÍA DE SKILLS DE CHARBI ---');

  // 1. Cargar herramientas
  await toolRegistry.loadTools();

  const names = toolRegistry.listNames();
  console.log(`\nHerramientas registradas (${names.length}):`);
  names.forEach(n => console.log(`- ${n}`));

  const required = [
    'system.search',
    'system.fetch',
    'system.shell.execute',
    'cognitive.brain_recall',
    'cognitive.graph_tools'
  ];

  console.log('\nVerificando disponibilidad de esenciales:');
  for (const req of required) {
    const found = names.some(n => n.includes(req));
    console.log(`${found ? '✅' : '❌'} ${req}`);
  }

  // 2. Probar ejecución básica (un listado de archivos seguro)
  console.log('\nPrueba de ejecución (system.read):');
  const res = await executeAction({
    type: 'system.read',
    origin: 'verification_script',
    params: { path: './package.json' },
    permissions: ['filesystem.read']
  });

  console.log(res.success ? '✅ Ejecución exitosa' : `❌ Fallo: ${res.error}`);
  process.exit(0);
}

verify().catch(console.error);
