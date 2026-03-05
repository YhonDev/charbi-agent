// tests/system/mission_llm_observational.ts
// Runs 5 real missions with Qwen via LLM Adapter.

import { generatePlan } from '../../kernel/llm_connector';
import { executeLLMPlan } from '../../kernel/llm_adapter';
import { getAggregateMetrics, getSessionMetrics } from '../../kernel/metrics';
import { scout } from '../../kernel/scout';
import { shutdownPool } from '../../kernel/compute_pool';

const MISSIONS = [
  'Check the latest release version of the nodejs/node repository on GitHub',
  'List the most recent 3 issues from the expressjs/express repository on GitHub',
  'Compare the latest releases of nodejs/node and denoland/deno repositories',
  'Analyze the repository structure of expressjs/express and generate a summary',
  'Check if there are any security advisories for the lodash npm package on GitHub',
];

function buildToolFns(sessionId: string): Map<string, (opts: { signal: AbortSignal }) => Promise<any>> {
  return new Map<string, (opts: { signal: AbortSignal }) => Promise<any>>([
    ['fetch-release', async () => scout({ url: 'https://api.github.com/repos/nodejs/node/releases/latest', sessionId, agent: 'llm-qwen' })],
    ['fetch-issues', async () => scout({ url: 'https://api.github.com/repos/expressjs/express/issues?per_page=3', sessionId, agent: 'llm-qwen' })],
    ['fetch-node', async () => scout({ url: 'https://api.github.com/repos/nodejs/node/releases/latest', sessionId, agent: 'llm-qwen' })],
    ['fetch-deno', async () => scout({ url: 'https://api.github.com/repos/denoland/deno/releases/latest', sessionId, agent: 'llm-qwen' })],
    ['fetch-express', async () => scout({ url: 'https://api.github.com/repos/expressjs/express', sessionId, agent: 'llm-qwen' })],
    ['fetch-lodash', async () => scout({ url: 'https://api.github.com/repos/lodash/lodash/security/advisories', sessionId, agent: 'llm-qwen' })],
    ['network.fetch', async (opts: any) => ({ type: 'network.fetch', details: opts.details })]
  ]);
}

async function runMission(index: number, objective: string) {
  console.log(`\n🧠 Mission ${index + 1}/5: ${objective}`);
  const planResult = await generatePlan(objective);
  if (!planResult.parsed) return;

  const sessionId = `llm-obs-${index + 1}`;
  const toolFns = buildToolFns(sessionId);

  const result = await executeLLMPlan(planResult.parsed, 'llm-qwen', toolFns);
  console.log(`  📊 Outcome: ${result.metrics?.outcome} | Steps: ${result.metrics?.stepsExecuted}/${result.metrics?.stepsProposed}`);
  if (result.validation.stripped.length > 0) console.log(`  Stripped: ${result.validation.stripped.length}`);
}

async function main() {
  for (let i = 0; i < MISSIONS.length; i++) await runMission(i, MISSIONS[i]);
  const agg = getAggregateMetrics();
  console.log(`\n📊 FINAL AGGREGATE: Missions: ${agg.totalMissions}, Block Rate: ${(agg.blockRate * 100).toFixed(1)}%`);
  shutdownPool();
}

main().catch(console.error);
