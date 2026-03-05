// scripts/test_cognition.ts
import { contextBuilder } from '../kernel/cognition/context_builder';
import { memoryClient } from '../kernel/cognition/memory_client';

async function test() {
  console.log('--- TEST DE COGNICIÓN Y MEMORIA ---');

  // 1. Añadir una relación al grafo para la prueba
  console.log('\n1. Guardando relación de prueba...');
  await memoryClient.call('graph.add_relation', {
    subject: 'Yhon',
    relation: 'creó a',
    object: 'Charbi',
    metadata: { date: new Date().toISOString() }
  });

  // 2. Construir contexto para una pregunta relacionada
  console.log('\n2. Construyendo contexto para: "¿Quién me creó?"');
  const prompt = await contextBuilder.build({
    agentName: 'default',
    userInput: '¿Quién me creó?',
    toolsSchema: '{"tools": []}'
  });

  console.log('\n--- PROMPT GENERADO ---');
  console.log(prompt);
  console.log('\n--- FIN DEL TEST ---');

  // El proceso se cerrará solo
  process.exit(0);
}

test().catch(console.error);
