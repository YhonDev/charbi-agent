// scripts/test_task_graph.ts
import { Orchestrator } from '../kernel/orchestrator';
import { emitEvent } from '../kernel/event_bus';
import { v4 as uuidv4 } from 'uuid';

async function testProject() {
  console.log('--- TEST DE TASK GRAPH ENGINE ---');
  console.log('Simulando petición de proyecto complejo...');

  // Instanciar orquestador (inicia listeners)
  new Orchestrator();

  // Emitir un evento de complejidad alta para disparar el TaskPlanner
  emitEvent({
    id: uuidv4(),
    type: 'USER_REQUEST',
    timestamp: Date.now(),
    origin: 'test_script',
    payload: {
      text: 'Crea un script de python que busque noticias de IA y las guarde en un markdown',
      chatId: 'test_123'
    }
  });

  console.log('Petición enviada. Esperando ejecución...');

  // Mantener vivo el proceso un tiempo para ver los logs
  setTimeout(() => {
    console.log('\n--- FIN DEL TEST (TIMEOUT) ---');
    process.exit(0);
  }, 30000);
}

testProject().catch(console.error);
