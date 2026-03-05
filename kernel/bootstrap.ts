// kernel/bootstrap.ts
// Boot sequence para Charbi Kernel.
// Config -> Channels -> Plugins -> SkillRegistry -> EventBus -> READY

import { v4 as uuidv4 } from 'uuid';
import ConfigService from './config_service';
import { ChannelRegistry } from './channel_registry';
import { PluginLoader } from './plugin_loader';
import { SkillRegistry } from './skill_registry';
import { Orchestrator } from './orchestrator';
import { emitEvent } from './event_bus';
import { ServiceManager } from './runtime/service_manager';
import { providerRegistry } from './providers/provider_registry';
import fs from 'fs';
import path from 'path';

const PID_FILE = path.join(process.env.CHARBI_HOME || path.join(require('os').homedir(), '.charbi-agent'), 'run', 'kernel.pid');

async function boot(): Promise<void> {
  const startTime = Date.now();

  console.log('');
  console.log('========================================');
  console.log('');

  // Guardar PID para control de daemon
  try {
    const runDir = path.dirname(PID_FILE);
    if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(PID_FILE, process.pid.toString());
  } catch (e) {
    console.warn('[Boot] Could not write PID file:', e);
  }

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
  console.log('[Boot] Step 3/5: Scanning plugins...');
  const pluginLoader = new PluginLoader();
  await pluginLoader.scan();
  const plugins = pluginLoader.listPlugins();
  console.log('[Boot] Discovered plugins: ' + plugins.length);

  // Step 4: Load LLM Providers
  console.log('[Boot] Step 4/6: Loading LLM providers...');
  await providerRegistry.loadProviders();
  console.log('[Boot] Providers available: ' + providerRegistry.list().join(', '));

  // Step 5: Register in SkillRegistry
  console.log('[Boot] Step 4/5: Registering skills...');
  const skillRegistry = SkillRegistry.getInstance();
  for (const plugin of plugins) {
    skillRegistry.register(plugin.manifest as any, plugin.path);
  }
  console.log('[Boot] Registered skills: ' + skillRegistry.count());

  // Step 5: Initialize Services
  console.log('[Boot] Step 5/6: Registering services...');

  // Register Orchestrator Service
  ServiceManager.register({
    name: 'orchestrator',
    type: 'core',
    start: async () => { new Orchestrator(); },
    stop: async () => { /* Orchestrator is event-based, nothing specific to stop yet */ },
    running: false
  });

  // Register Channel Service (as an aggregate)
  ServiceManager.register({
    name: 'channels',
    type: 'core',
    start: async () => {
      // Logic handled in registry but we keep the manager aware
    },
    stop: async () => { await channelRegistry.stopAll(); },
    running: true // Assume already started by channelRegistry.startAll() for now
  });

  await ServiceManager.start('orchestrator');

  // Step 6: Emit READY
  console.log('[Boot] Step 6/6: Emitting READY event...');
  const bootTimeMs = Date.now() - startTime;
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
      skills: skillRegistry.listAll().map(s => s.manifest.name),
      bootTimeMs,
    }
  });

  console.log('');
  console.log('[Boot] Charbi Kernel is READY (' + bootTimeMs + 'ms)');
  console.log('[Boot] Channels: ' + (activeChannels.length > 0 ? activeChannels.join(', ') : 'CLI only'));
  console.log('[Boot] Skills: ' + (skillRegistry.count() > 0 ? skillRegistry.listAll().map(s => s.manifest.name).join(', ') : 'none'));
  console.log('[Boot] Listening for requests...');
  console.log('');


  // Graceful Shutdown
  const shutdown = async () => {
    console.log('\n[Boot] Shutting down...');
    if (fs.existsSync(PID_FILE)) {
      try { fs.unlinkSync(PID_FILE); } catch (e) { }
    }
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
