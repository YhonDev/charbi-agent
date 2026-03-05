// charbi/kernel/router.ts
import { v4 as uuid } from 'uuid';

export type TaskAnalysis = {
  id: string;
  complexity: number;
  risk: 'low' | 'medium' | 'high';
  specialist: 'coder' | 'scholar' | 'scout' | 'main';
  requiresTools: boolean;
};

/**
 * Basic task analyzer (Router)
 * This is a placeholder for the cognitive triaje logic.
 */
export async function analyzeTask(userInput: string): Promise<TaskAnalysis> {
  const complexity = guessComplexity(userInput);

  // Basic heuristic: logic -> coder, study/info -> scholar, system -> scout, simple -> main
  let specialist: TaskAnalysis['specialist'] = 'main';

  if (userInput.match(/program|sima|clase|universidad|estudio|investigar|code|debug|script|config|update|install/i)) {
    if (userInput.match(/program|code|debug|script/i)) specialist = 'coder';
    else if (userInput.match(/sima|clase|universidad|estudio|investigar/i)) specialist = 'scholar';
    else if (userInput.match(/config|update|install/i)) specialist = 'scout';
  }

  return {
    id: uuid(),
    complexity,
    risk: complexity > 0.8 ? 'high' : complexity > 0.5 ? 'medium' : 'low',
    specialist,
    requiresTools: complexity > 0.4,
  };
}

function guessComplexity(s: string): number {
  // Temporary heuristic based on string length and keywords
  const lengthScore = Math.min(0.5, s.length / 500);
  const keywordScore = s.match(/implement|create|refactor|fix|complex/i) ? 0.4 : 0.1;
  return Math.min(1, lengthScore + keywordScore);
}
