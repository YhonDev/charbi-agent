import { eventBus, EventType } from './kernel/event_bus';
import { Orchestrator } from './kernel/orchestrator';
import ConfigService from './kernel/config_service';
import { providerRegistry } from './kernel/providers/provider_registry';
import { toolRegistry } from './kernel/tool_registry';
import { v4 as uuidv4 } from 'uuid';

async function runVerboseTest() {
  console.log('🔍 Starting Verbose Communication Flow Test');

  // 1. Setup Listeners for all events
  const eventTypes = Object.values(EventType);
  eventTypes.forEach(type => {
    eventBus.on(type, (event: any) => {
      console.log(`[EVENT捕捉] 🔔 ${type.toUpperCase()}:`, JSON.stringify(event.payload || {}, null, 2));
    });
  });

  // 2. Initialize Core Components
  console.log('\n--- initializing core ---');
  const config = ConfigService.getInstance();
  console.log('Config Provider:', config.getProvider().name);
  console.log('Config Model:', config.getProvider().model);

  await providerRegistry.loadProviders();
  await toolRegistry.loadTools();

  // Initialize Orchestrator (it registers its own listeners)
  const orchestrator = Orchestrator.getInstance();
  console.log('Orchestrator initialized.');

  // 3. Emit Request
  console.log('\n--- emitting request ---');
  const requestId = uuidv4();
  const testPayload = {
    text: 'haz una lista de 3 frutas',
    chatId: 'test-session-123'
  };

  eventBus.emit(EventType.USER_REQUEST, {
    id: requestId,
    type: EventType.USER_REQUEST,
    timestamp: Date.now(),
    origin: 'verbose-test',
    payload: testPayload
  });

  console.log('Request emitted. Waiting 30s for response loop...');

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('\n❌ TIMEOUT: No final response received within 30s.');
      resolve(null);
    }, 30000);

    eventBus.on(EventType.AGENT_RESPONSE, (event) => {
      if (event.payload?.chatId === 'test-session-123') {
        console.log('\n✅ SUCCESS: Captured final AGENT_RESPONSE!');
        console.log('Text:', event.payload.text);
        clearTimeout(timeout);
        resolve(null);
      }
    });
  });
}

runVerboseTest().then(() => {
  console.log('Test finished.');
  process.exit(0);
}).catch(err => {
  console.error('Test Fatal Error:', err);
  process.exit(1);
});
