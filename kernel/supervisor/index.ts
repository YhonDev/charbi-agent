// charbi/kernel/supervisor/index.ts
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { loadConfig } from '../config_loader';

// Note: In a real implementation, you'd use a proper YAML loader. 
// For this script-like implementation, we'll read it directly.
const POLICY_PATH = path.join(process.cwd(), 'config', 'policies', 'default.yaml');

export type ActionDetails = {
  type: string;
  details: any;
  permissionProfile?: Record<string, boolean>;
};

export type Decision = 'allow' | 'block' | 'escalate';

export function inspect(action: ActionDetails): { allow: boolean, decision: Decision, rule: string } {
  const config = loadConfig();
  const mode = config.system.mode || 'production';

  let policies: any;
  try {
    const fileContents = fs.readFileSync(POLICY_PATH, 'utf8');
    policies = yaml.load(fileContents);
  } catch (e) {
    console.error(`[Supervisor] Error loading policies: ${e}`);
    return { allow: false, decision: 'block', rule: 'policy-load-error' };
  }

  // 0. Safe Mode strict overrides
  if (mode === 'safe') {
    if (action.type === 'shell.execute') return { allow: false, decision: 'block', rule: 'safe-mode-no-shell' };
  }

  for (const r of policies.rules) {
    if (r.action === action.type) {
      if (evaluateCondition(r.condition, action.details)) {
        const decision: Decision = r.deny ? 'block' : (r.escalate ? 'escalate' : 'allow');

        // Development mode override: log but allow (optional logic)
        if (mode === 'development' && decision === 'block') {
          console.warn(`[Supervisor] DEV MODE: Overriding block for rule ${r.id}`);
          return { allow: true, decision: 'allow', rule: `dev-override-${r.id}` };
        }

        return { allow: !r.deny && decision !== 'escalate', decision, rule: r.id };
      }
    }
  }

  // Default: Deny for risky actions if no rule matches
  const riskyActions = ['shell.execute', 'filesystem.write', 'network.access', 'filesystem.read', 'network.fetch'];
  if (riskyActions.includes(action.type)) {
    return { allow: false, decision: 'block', rule: 'default-deny-risky' };
  }

  return { allow: true, decision: 'allow', rule: 'default-allow' };
}

function evaluateCondition(cond: string, details: any): boolean {
  if (!cond) return true;

  if (cond.includes('contains')) {
    const [_, token] = cond.split("contains");
    const cleanToken = token.replace(/'/g, '').trim();
    return details.command && details.command.includes(cleanToken);
  }

  if (cond.includes('starts_with')) {
    const [_, p] = cond.split('starts_with');
    const cleanPath = p.replace(/'/g, '').trim();
    return details.path && details.path.startsWith(cleanPath);
  }

  if (cond.includes('dest_in_whitelist')) {
    const whitelist = (process.env.NET_WHITELIST || '').split(',');
    return !!details.dest && whitelist.includes(details.dest);
  }

  return false;
}
