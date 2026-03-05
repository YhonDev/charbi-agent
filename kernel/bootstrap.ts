// kernel/bootstrap.ts
// Boot sequence para Charbi Kernel.
// Config -> Channels -> Plugins -> EventBus -> READY

import { v4 as uuidv4 } from 'uuid';
import ConfigService from './config_service';
import { ChannelRegistry } from './channel_registry';
import { PluginLoader } from './plugin_loader';
import { emitEvent } from './event_bus';

async function boot(): Promise<void> {
  const startTime = Date.now();

  console.log('');
  console.log('========================================');
  console.log('     CHARBI KERNEL BOOTSTRAP');
  console.log('========================================');
  console.log('');

  // Step 1: Load Configuration
  console.log('[Boot] Step 1/4: Loading configuration...');
  const configService = ConfigService.getInstance();
  const system = configService.getSystem();
  console.log('[Boot] System: ' + system.name + ' v' + system.version + ' (' + system.mode + ')');

  const provider = configService.getProvider();
  const models = configService.getModels();
  console.log('[Boot] Provider: ' + (provider?.name || 'none') + ' (' + (models?.router || 'none') + ')');

  if (system.mode === 'development') {
    configService.enableHotReload();
  }

  // Step 2: Initialize Channels
  console.log('[Boot] Step 2/4: Loading channels...');
  const channelRegistry = new ChannelRegistry();
  await channelRegistry.init();
  await channelRegistry.startAll();
  const activeChannels = channelRegistry.listActive();
  console.log('[Boot] Active channels: ' + (activeChannels.length > 0 ? activeChannels.join(', ') : 'none'));

  // Step 3: Load Plugins
  console.log('[Boot] Step 3/4: Scanning plugins...');
  const pluginLoader = new PluginLoader();
  await pluginLoader.scan();
  const plugins = pluginLoader.listPlugins();
  console.log('[Boot] Registered plugins: ' + plugins.length);

  // Step 4: Emit READY
  console.log('[Boot] Step 4/4: Emitting READY event...');
  emitEvent({
    id: uuidv4(),
    type: 'SYSTEM_READY',
    timestamp: Date.now(),
    origin: 'bootstrap',
    payload: {
      system: system.name,
      version: system.version,
      channels: activeChannels,
      plugins: plugins.map(p => p.manifest.name),
      bootTimeMs: Date.now() - startTime,
    }
  });

  const elapsed = Date.now() - startTime;
  console.log('');
  console.log('[Boot] Charbi Kernel is READY (' + elapsed + 'ms)');
  console.log('[Boot] Channels: ' + (activeChannels.length > 0 ? activeChannels.join(', ') : 'CLI only'));
  console.log('');

  // Graceful Shutdown
  const shutdown = async () => {
    console.log('\n[Boot] Shutting down...');
    configService.disableHotReload();
    await channelRegistry.stopAll();
    console.log('[Boot] Goodbye');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

boot().catch((err) => {
  console.error('[Boot] FATAL ERROR:', err);
  process.exit(1);
});
