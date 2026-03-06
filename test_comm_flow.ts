import { providerRegistry } from './kernel/providers/provider_registry';
import ConfigService from './kernel/config_service';
import { queryLLM } from './kernel/llm_connector';
import { eventBus, EventType } from './kernel/event_bus';

async function testFlow() {
  console.log('🚀 Starting Component Communication Flow Test');

  // 1. Check Config
  console.log('\n--- 1. Configuration Check ---');
  const configService = ConfigService.getInstance();
  const providerConfig = configService.getProvider();
  console.log('Provider Config:', JSON.stringify(providerConfig, null, 2));

  // 2. Check Provider Registry
  console.log('\n--- 2. Provider Registry Check ---');
  await providerRegistry.loadProviders();
  const available = providerRegistry.list();
  console.log('Available Providers:', available);

  const targetProvider = providerConfig?.name || 'ollama';
  if (!providerRegistry.has(targetProvider)) {
    console.error(`❌ Provider ${targetProvider} NOT found in registry!`);
    process.exit(1);
  }
  console.log(`✅ Provider ${targetProvider} is registered.`);

  // 3. Test LLM Connectivity
  console.log('\n--- 3. LLM Connectivity Test (Direct) ---');
  try {
    const provider = providerRegistry.getProvider(targetProvider);
    await provider.initialize(providerConfig);
    console.log(`Initializated ${targetProvider}...`);

    console.log('Sending test message to LLM (timeout 60s)...');
    const response = await provider.chat([{ role: 'user', content: 'Say "HELLO_TEST"' }]);

    if (response.success) {
      console.log('✅ LLM Response Success!');
      console.log('Content:', response.content);
      console.log('Latency:', response.latencyMs, 'ms');
    } else {
      console.error('❌ LLM Response Failed:', response.error);
    }
  } catch (e: any) {
    console.error('❌ Error during direct LLM test:', e.message);
  }

  // 4. Test EventBus
  console.log('\n--- 4. EventBus Communication Check ---');
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('❌ EventBus test TIMEOUT - No response captured.');
      resolve(null);
    }, 5000);

    eventBus.on(EventType.AGENT_RESPONSE, (event) => {
      console.log('✅ Captured AGENT_RESPONSE from EventBus:', JSON.stringify(event.payload, null, 2));
      clearTimeout(timeout);
      resolve(null);
    });

    console.log('Emitting mock USER_REQUEST...');
    eventBus.emit(EventType.USER_REQUEST, {
      id: 'test-event-id',
      type: EventType.USER_REQUEST,
      timestamp: Date.now(),
      origin: 'test-script',
      payload: { text: 'test event', chatId: 'test-chat' }
    });
  });
}

testFlow().then(() => {
  console.log('\n✅ Test execution completed.');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Fatal Test Error:', err);
  process.exit(1);
});
