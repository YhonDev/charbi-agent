// kernel/test_telegram_out.ts
import { emitEvent } from './event_bus';
import ConfigService from './config_service';
import { ChannelRegistry } from './channel_registry';
import { v4 as uuidv4 } from 'uuid';

async function test() {
  const configService = ConfigService.getInstance();
  const channelRegistry = new ChannelRegistry();

  await channelRegistry.init();
  await channelRegistry.startAll();

  console.log('[Test] Sending test message to Telegram...');

  emitEvent({
    id: uuidv4(),
    type: 'TELEGRAM_RESPONSE',
    timestamp: Date.now(),
    origin: 'test-script',
    payload: {
      chatId: '201060243',
      text: '🚀 *¡Charbi Kernel en línea!*\n\nConexión con Telegram verificada correctamente. El sistema de eventos está activo.'
    }
  });

  // Wait a bit for the message to be sent
  setTimeout(async () => {
    await channelRegistry.stopAll();
    process.exit(0);
  }, 3000);
}

test().catch(console.error);
