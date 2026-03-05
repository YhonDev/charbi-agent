// charbi/kernel/scout.ts
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { log } from './logger';
import { recordJournal } from './journal';
import { remember, recall } from './memory_engine';
import { runHeavyTask, initPool } from './compute_pool';

const NETWORK_POLICY_PATH = path.join(process.cwd(), 'config', 'policies', 'network.yaml');

interface NetworkPolicy {
  network: {
    allowed_domains: string[];
    methods: string[];
    maxResponseSizeKB: number;
    timeoutMs: number;
    followRedirects: boolean;
    allowIPs: boolean;
    maxRequestsPerSession: number;
    cooldownMs: number;
  };
}

interface ScoutResult {
  success: boolean;
  url: string;
  contentHash: string;
  data: any;
  analysis?: any;
  error?: string;
  timing: { fetchMs: number; parseMs: number; totalMs: number };
}

// Rate limiting state
const sessionRequests: Map<string, { count: number; lastRequest: number }> = new Map();

function loadNetworkPolicy(): NetworkPolicy {
  const raw = fs.readFileSync(NETWORK_POLICY_PATH, 'utf8');
  return yaml.load(raw) as NetworkPolicy;
}

/**
 * isPrivateOrDangerous
 * Anti-SSRF: blocks private IPs, localhost, link-local, and cloud metadata endpoints.
 */
function isPrivateOrDangerous(hostname: string): { blocked: boolean; reason?: string } {
  const lower = hostname.toLowerCase();

  // Localhost variants
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'].includes(lower)) {
    return { blocked: true, reason: 'Localhost access blocked (SSRF)' };
  }

  // Cloud metadata endpoints
  const metadataHosts = ['169.254.169.254', 'metadata.google.internal', 'metadata.internal'];
  if (metadataHosts.includes(lower)) {
    return { blocked: true, reason: 'Cloud metadata endpoint blocked (SSRF)' };
  }

  // Private IP ranges
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (a === 10) return { blocked: true, reason: 'Private IP range 10.x blocked (SSRF)' };
    if (a === 172 && b >= 16 && b <= 31) return { blocked: true, reason: 'Private IP range 172.16-31.x blocked (SSRF)' };
    if (a === 192 && b === 168) return { blocked: true, reason: 'Private IP range 192.168.x blocked (SSRF)' };
    if (a === 169 && b === 254) return { blocked: true, reason: 'Link-local range 169.254.x blocked (SSRF)' };
    if (a === 0) return { blocked: true, reason: 'Zero-prefix IP blocked (SSRF)' };
  }

  return { blocked: false };
}

/**
 * validateUrl
 * Enforces network policy: whitelist, anti-SSRF, no IPs, protocol check.
 */
function validateUrl(url: string, policy: NetworkPolicy): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Malformed URL' };
  }

  // Protocol check first
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, reason: `Protocol '${parsed.protocol}' not allowed` };
  }

  // Anti-SSRF: always check, regardless of policy
  const ssrfCheck = isPrivateOrDangerous(parsed.hostname);
  if (ssrfCheck.blocked) {
    return { valid: false, reason: ssrfCheck.reason };
  }

  // No IP addresses (even public ones, unless policy allows)
  if (policy.network.allowIPs === false) {
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipRegex.test(parsed.hostname)) {
      return { valid: false, reason: 'Direct IP access forbidden' };
    }
  }

  // Domain whitelist
  if (!policy.network.allowed_domains.includes(parsed.hostname)) {
    return { valid: false, reason: `Domain '${parsed.hostname}' not in whitelist` };
  }

  return { valid: true };
}

/**
 * checkRateLimit
 * Enforces per-session rate limiting.
 */
function checkRateLimit(sessionId: string, policy: NetworkPolicy): { allowed: boolean; reason?: string } {
  const state = sessionRequests.get(sessionId) || { count: 0, lastRequest: 0 };
  const now = Date.now();

  if (state.count >= policy.network.maxRequestsPerSession) {
    return { allowed: false, reason: `Session limit reached (${policy.network.maxRequestsPerSession})` };
  }

  if (now - state.lastRequest < policy.network.cooldownMs) {
    return { allowed: false, reason: `Cooldown active (${policy.network.cooldownMs}ms)` };
  }

  state.count++;
  state.lastRequest = now;
  sessionRequests.set(sessionId, state);
  return { allowed: true };
}

/**
 * fetchSecure
 * Performs an HTTP GET with size limits, timeout, and no redirects.
 */
function fetchSecure(url: string, policy: NetworkPolicy, headers?: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const options = {
      timeout: policy.network.timeoutMs,
      headers: {
        'User-Agent': 'Charbi-Kernel/2.0 (Governed Runtime)',
        'Accept': 'application/json',
        ...headers
      }
    };

    const req = client.get(url, options, (res) => {
      // Block redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
        req.destroy();
        return reject(new Error(`Redirect blocked (${res.statusCode})`));
      }

      if (res.statusCode && res.statusCode >= 400) {
        req.destroy();
        return reject(new Error(`HTTP error: ${res.statusCode}`));
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      const maxBytes = policy.network.maxResponseSizeKB * 1024;

      res.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > maxBytes) {
          req.destroy();
          reject(new Error(`Response too large (>${policy.network.maxResponseSizeKB}KB)`));
        } else {
          chunks.push(chunk);
        }
      });

      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', (e) => reject(e));
  });
}

/**
 * scout
 * Main entry point: fetch → validate → parse → analyze → commit to memory.
 */
export async function scout(params: {
  url: string;
  sessionId: string;
  agent: string;
  analyze?: boolean;
  tags?: string[];
}): Promise<ScoutResult> {
  const startTotal = Date.now();
  const policy = loadNetworkPolicy();

  // 1. Validate URL against policy
  const validation = validateUrl(params.url, policy);
  if (!validation.valid) {
    recordJournal({
      sessionId: params.sessionId,
      type: 'SECURITY_INCIDENT',
      level: 'WARN',
      data: { event: 'SCOUT_BLOCKED', url: params.url, reason: validation.reason }
    });
    return { success: false, url: params.url, contentHash: '', data: null, error: validation.reason, timing: { fetchMs: 0, parseMs: 0, totalMs: 0 } };
  }

  // 2. Rate limit check
  const rateCheck = checkRateLimit(params.sessionId, policy);
  if (!rateCheck.allowed) {
    return { success: false, url: params.url, contentHash: '', data: null, error: rateCheck.reason, timing: { fetchMs: 0, parseMs: 0, totalMs: 0 } };
  }

  log({ level: 'INFO', module: 'Scout', message: `Fetching: ${params.url}`, sessionId: params.sessionId });

  // 3. Fetch
  const fetchStart = Date.now();
  let raw: string;
  try {
    raw = await fetchSecure(params.url, policy);
  } catch (e: any) {
    recordJournal({
      sessionId: params.sessionId,
      type: 'ACTION_RECORD',
      level: 'ERROR',
      data: { event: 'SCOUT_FETCH_FAILED', url: params.url, error: e.message }
    });
    return { success: false, url: params.url, contentHash: '', data: null, error: e.message, timing: { fetchMs: Date.now() - fetchStart, parseMs: 0, totalMs: Date.now() - startTotal } };
  }
  const fetchMs = Date.now() - fetchStart;

  // 4. Content hash (for dedup & integrity)
  const contentHash = crypto.createHash('sha256').update(raw).digest('hex');

  // 5. Check dedup: skip if same hash already in semantic memory
  const existing = recall({ type: 'semantic', tags: [contentHash] });
  if (existing.length > 0) {
    log({ level: 'INFO', module: 'Scout', message: `Dedup: content already in memory (${contentHash.substring(0, 12)}...)` });
    return { success: true, url: params.url, contentHash, data: existing[0].content, timing: { fetchMs, parseMs: 0, totalMs: Date.now() - startTotal } };
  }

  // 6. Parse in worker thread (offload from event loop)
  const parseStart = Date.now();
  let parsed: any;
  try {
    initPool();
    parsed = await runHeavyTask('parse-json', { raw });
  } catch {
    // Not JSON — store as text summary
    parsed = { type: 'text', length: raw.length, preview: raw.substring(0, 500) };
  }
  const parseMs = Date.now() - parseStart;

  // 7. Optional analysis
  let analysis: any = undefined;
  if (params.analyze && typeof parsed === 'object') {
    analysis = {
      keys: Object.keys(parsed).length,
      isArray: Array.isArray(parsed),
      itemCount: Array.isArray(parsed) ? parsed.length : undefined,
      sizeBytes: raw.length,
      generatedAt: new Date().toISOString()
    };
  }

  // 8. Auto-commit to semantic memory
  remember({
    type: 'semantic',
    sessionId: params.sessionId,
    agent: params.agent,
    content: {
      source: new URL(params.url).hostname,
      url: params.url,
      contentHash,
      data: parsed,
      analysis,
      retrievedAt: Date.now()
    },
    tags: [contentHash, new URL(params.url).hostname, ...(params.tags || [])]
  });

  recordJournal({
    sessionId: params.sessionId,
    type: 'ACTION_RECORD',
    level: 'INFO',
    data: { event: 'SCOUT_SUCCESS', url: params.url, contentHash: contentHash.substring(0, 16), sizeBytes: raw.length }
  });

  const totalMs = Date.now() - startTotal;
  return { success: true, url: params.url, contentHash, data: parsed, analysis, timing: { fetchMs, parseMs, totalMs } };
}
