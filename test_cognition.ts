import { cognitionLoader } from './kernel/cognition_loader';

async function test() {
  const prompt = cognitionLoader.buildSystemPrompt('main', '{}');
  console.log("=== SYSTEM PROMPT ===");
  console.log(prompt);
  console.log("=====================");
}

test();
