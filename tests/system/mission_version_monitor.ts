// tests/system/mission_version_monitor.ts
// Monitor release version and generate report.

import { createSession } from '../../kernel/process_manager';
import { registerGoal } from '../../kernel/goal_engine';
import { createDAGPlan, executeDAGPlan } from '../../kernel/plan_dag';
import { scout } from '../../kernel/scout';
import { recall } from '../../kernel/memory_engine';
import { shutdownPool } from '../../kernel/compute_pool';
import fs from 'fs';
import path from 'path';

async function run() {
  const sessionId = 'vm-' + Date.now();
  const session = createSession(sessionId);
  const objective = 'Monitor Node.js Version';
  const agent = 'version-monitor-agent';

  console.log(`🚀 Starting Version Monitor Mission`);

  const goal = registerGoal({ objective, agent });

  const plan = createDAGPlan(sessionId, agent, objective, [
    {
      id: 'fetch',
      description: 'Fetch latest release',
      resources: [],
      dependsOn: [],
      action: {
        type: 'network.fetch',
        details: { url: 'https://api.github.com/repos/nodejs/node/releases/latest' },
        fn: async () => scout({ url: 'https://api.github.com/repos/nodejs/node/releases/latest', sessionId, agent })
      }
    },
    {
      id: 'report',
      description: 'Compare and report',
      resources: [{ path: 'runtime/sessions', mode: 'WRITE' }],
      dependsOn: ['fetch'],
      action: {
        type: 'filesystem.write',
        details: { path: 'report.md' },
        fn: async () => {
          const memories = recall({ type: 'semantic', limit: 5 });
          const content = `Report: ${memories.length} memories available.`;
          fs.writeFileSync(path.join(session.workspace, 'report.md'), content);
          return { status: 'REPORT_WRITTEN' };
        }
      }
    }
  ]);

  const result = await executeDAGPlan(plan);
  console.log(`✅ Mission outcome: ${result.outcome}`);
  shutdownPool();
}

run().catch(console.error);
