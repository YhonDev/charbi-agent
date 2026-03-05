// charbi/kernel/llm_connector.ts
// Kernel-level LLM interface.

import https from 'https';
import { log } from './logger';
import { recordJournal } from './journal';

const LLM_TIMEOUT_MS = 15000;
const MAX_TOKENS = 2048;

interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  useVertex: boolean;
}

function getConfig(): LLMConfig {
  // Use Vertex AI (Google Cloud) if project ID and access token are present
  if (process.env.GOOGLE_PROJECT_ID && process.env.GEMINI_ACCESS_TOKEN) {
    const projectId = process.env.GOOGLE_PROJECT_ID.trim();
    return {
      baseUrl: `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-1.5-flash:generateContent`,
      apiKey: process.env.GEMINI_ACCESS_TOKEN.trim().replace(/\r/g, ''),
      model: 'gemini-1.5-flash',
      useVertex: true
    };
  }

  // Fallback to Qwen Portal
  if (process.env.QWEN_ACCESS_TOKEN) {
    return {
      baseUrl: 'https://portal.qwen.ai/v1/chat/completions',
      apiKey: process.env.QWEN_ACCESS_TOKEN.trim().replace(/\r/g, ''),
      model: 'coder-model',
      useVertex: false
    };
  }

  throw new Error('LLM credentials missing. Need GOOGLE_PROJECT_ID + GEMINI_ACCESS_TOKEN or QWEN_ACCESS_TOKEN.');
}

export async function queryLLM(systemPrompt: string, userPrompt: string): Promise<any> {
  const config = getConfig();
  const startTime = Date.now();

  if (config.useVertex) {
    return queryVertex(config, systemPrompt, userPrompt, startTime);
  } else {
    return queryOpenAIStyle(config, systemPrompt, userPrompt, startTime);
  }
}

async function queryVertex(config: LLMConfig, systemPrompt: string, userPrompt: string, startTime: number): Promise<any> {
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Objective: ${userPrompt}` }] }],
    generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.2 }
  });

  return new Promise((resolve) => {
    const url = new URL(config.baseUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      timeout: LLM_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        const latencyMs = Date.now() - startTime;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) return resolve({ success: false, error: parsed.error.message, latencyMs });
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve({ success: true, content, latencyMs });
        } catch (e: any) {
          resolve({ success: false, error: `Vertex Parse: ${e.message}`, latencyMs });
        }
      });
    });
    req.on('error', e => resolve({ success: false, error: e.message, latencyMs: Date.now() - startTime }));
    req.write(body);
    req.end();
  });
}

async function queryOpenAIStyle(config: LLMConfig, systemPrompt: string, userPrompt: string, startTime: number): Promise<any> {
  const body = JSON.stringify({
    model: config.model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
  });

  return new Promise((resolve) => {
    const url = new URL(config.baseUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      timeout: LLM_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        const latencyMs = Date.now() - startTime;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) return resolve({ success: false, error: parsed.error.message || JSON.stringify(parsed.error), latencyMs });
          const content = parsed.choices?.[0]?.message?.content || '';
          resolve({ success: true, content, latencyMs });
        } catch (e: any) {
          resolve({ success: false, error: `JSON: ${e.message}`, latencyMs });
        }
      });
    });
    req.on('error', e => resolve({ success: false, error: e.message, latencyMs: Date.now() - startTime }));
    req.write(body);
    req.end();
  });
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
