// charbi/kernel/doctor.ts
import { loadConfig } from './config_loader';
import { inspect } from './supervisor';
import fs from 'fs';
import path from 'path';

async function checkTelegram() {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) return { ok: false, msg: 'TELEGRAM_TOKEN not found in env' };
  // Mock check for now, in real life call getMe()
  return { ok: true, msg: 'Telegram token present' };
}

export async function runDoctor() {
  console.log('🩺 Charbi Kernel Diagnostic (Doctor)\n');

  // 1. Config
  try {
    const config = loadConfig();
    console.log('✔ Config loaded successfully');
  } catch (e) {
    console.log('✖ Config load failed');
  }

  // 2. Supervisor
  const policyPath = path.join(process.cwd(), 'config', 'policies', 'default.yaml');
  if (fs.existsSync(policyPath)) {
    console.log('✔ Supervisor policies found');
  } else {
    console.log('✖ Supervisor policies missing');
  }

  // 3. Runtime
  const sessionPath = path.join(process.cwd(), 'runtime', 'sessions');
  if (fs.existsSync(sessionPath)) {
    console.log('✔ Runtime session path exists');
  } else {
    console.log('✖ Runtime session path missing');
  }

  // 4. Memory
  const dbPath = path.join(process.cwd(), 'memory');
  if (fs.existsSync(dbPath)) {
    console.log('✔ Memory directory exists');
  } else {
    console.log('✖ Memory directory missing');
  }

  // 5. Telegram
  const tgStatus = await checkTelegram();
  if (tgStatus.ok) {
    console.log(`✔ ${tgStatus.msg}`);
  } else {
    console.log(`✖ ${tgStatus.msg}`);
  }

  console.log('\nDiagnostic complete.');
}

if (require.main === module) {
  runDoctor();
}
