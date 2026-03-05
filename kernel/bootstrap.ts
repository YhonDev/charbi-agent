// kernel/bootstrap.ts
// Boot sequence para Charbi Kernel.
// Config → Channels → Plugins → EventBus → READY

import { ConfigService } from './config_service';
import { ChannelRegistry } from './channel_registry';
import { PluginLoader } from './plugin_loader';
import { emitEvent } from './event_bus';

async function boot(): Promise<void> {
  const startTime = Date.now();

  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║        👻 CHARBI KERNEL BOOTSTRAP         ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');

  // ─── STEP 1: Load Configuration ───
  console.log('[Boot] Step 1/4: Loading configuration...');
  const configService = ConfigService.getInstance();
  const system = configService.getSystem();
  console.log('[Boot] System: ' + system.name + ' v' + system.version + ' (' + system.mode + ')');
  console.log('[Boot] Provider: ' + configService.getProvider()?.name + ' (' + configService.getModels()?.router + ')');

  // Enable hot-reload in development
  if (system.mode === 'development') {
    configService.enableHotReload();
  }

  // ─── STEP 2: Initialize Channels ───
  console.log('[Boot] Step 2/4: Loading channels...');
  const channelRegistry = new ChannelRegistry();
  await channelRegistry.init();
  await channelRegistry.startAll();

  const activeChannels = channelRegistry.listActive();
  console.log('[Boot] Active channels: ' + (activeChannels.length > 0 ? activeChannels.join(', ') : 'none'));

  // ─── STEP 3: Load Plugins ───
  console.log('[Boot] Step 3/4: Scanning plugins...');
  const pluginLoader = new PluginLoader();
  await pluginLoader.scan();

  const plugins = pluginLoader.listPlugins();
  console.log('[Boot] Registered plugins: ' + plugins.length);

  // ─── STEP 4: Emit READY ───
  console.log('[Boot] Step 4/4: Emitting READY event...');
  emitEvent({
    type: 'SYSTEM_READY', payload: {
      system: system.name,
      version: system.version,
      channels: activeChannels,
      plugins: plugins.map(p => p.manifest.name),
      bootTimeMs: Date.now() - startTime,
    }
  });

  console.log('');
  console.log('[Boot] ✅ Charbi Kernel is READY (' + (Date.now() - startTime) + 'ms)');
  console.log('[Boot] Listening on channels: ' + (activeChannels.length > 0 ? activeChannels.join(', ') : 'CLI only'));
  console.log('');

  // ─── Graceful Shutdown ───
  const shutdown = async () => {
    console.log('\n[Boot] Shutting down...');
    configService.disableHotReload();
    await channelRegistry.stopAll();
    console.log('[Boot] Goodbye 👻');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ─── Entry Point ───
boot().catch((err) => {
  console.error('[Boot] ❌ FATAL ERROR:', err);
  process.exit(1);
});
