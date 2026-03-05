import { log } from './logger';
import { recordJournal } from './journal';
import ConfigService from './config_service';
import { AuthManager } from './auth/auth_manager';
import { providerRegistry } from './providers/provider_registry';

const LLM_TIMEOUT_MS = 15000;
const MAX_TOKENS = 2048;

// The old LLMConfig and getConfig are replaced by the Provider Registry system
// which is initialized during bootstrap.

export async function queryLLM(systemPrompt: string, userPrompt: string): Promise<any> {
  const configService = ConfigService.getInstance();
  const providerConfig = configService.getProvider();
  const providerName = providerConfig?.name || 'ollama';
  const startTime = Date.now();

  try {
    const provider = providerRegistry.getProvider(providerName);

    // Preparar mensajes en formato estándar (OpenAI-like)
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Obtener token/key si es necesario
    const authKey = AuthManager.getToken(providerName);
    const config = {
      ...(providerConfig as any),
      apiKey: authKey || (providerConfig as any)?.apiKey,
    };

    // Inicializar (o re-inicializar si cambió algo)
    await provider.initialize(config);

    // Llamar al provider
    const res = await provider.chat(messages);

    return {
      success: res.success,
      content: res.content,
      latencyMs: res.latencyMs,
      error: res.error,
      usage: res.usage
    };

  } catch (e: any) {
    return {
      success: false,
      error: e.message,
      latencyMs: Date.now() - startTime
    };
  }
}

export async function generatePlan(objective: string, context?: string): Promise<any> {
  const systemPrompt = `You are a Charbi Kernel planning engine. Decompose objective into JSON:
{
  "objective": "...",
  "steps": [
    { "id": "s1", "description": "...", "dependsOn": [], "resources": [], "action": {"type": "network.fetch", "details": {"url": "..."}} }
  ]
}
RULES: valid JSON ONLY. Steps: filesystem.read|write, network.fetch, shell.execute.`;

  const userPrompt = context ? `Objective: ${objective}\nContext: ${context}` : objective;
  const res = await queryLLM(systemPrompt, userPrompt);

  if (!res.success) return { raw: '', parsed: null, latencyMs: res.latencyMs };

  let jsonStr = res.content.trim();
  const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) jsonStr = m[1].trim();
  const t = jsonStr.match(/<\/think>\s*([\s\S]*)/);
  if (t) jsonStr = t[1].trim();

  let parsed = null;
  try { parsed = JSON.parse(jsonStr); } catch { log({ level: 'WARN', module: 'LLMConnector', message: 'JSON Parse Fail' }); }

  recordJournal({ sessionId: 'llm', type: 'ACTION_RECORD', level: 'INFO', data: { event: 'PLAN_GEN', objective, ok: !!parsed } });
  return { raw: res.content, parsed, latencyMs: res.latencyMs };
}
