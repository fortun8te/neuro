#!/usr/bin/env node
/**
 * Test Adaptive Research System
 */

import { analyzeComplexity, generateTierQueries, estimateSources, estimateTools, formatComplexityReport } from './src/utils/adaptiveResearch.ts';

const testQuestions = [
  "What is the capital of France?",
  "Compare React and Vue frameworks",
  "What are the latest AI regulations across EU, US, China and their geopolitical implications?",
  "Analyze the psychological drivers of collagen supplement adoption among Gen Z and how influencer marketing affects purchasing decisions",
  "How are voice assistants actually being used vs marketed, including adoption rates, real use cases, privacy concerns, and barriers to deeper integration?",
];

console.log(`╔════════════════════════════════════════════════════════════╗`);
console.log(`║         ADAPTIVE RESEARCH SYSTEM TEST                      ║`);
console.log(`║              5 Questions, Auto-Evaluated Depth             ║`);
console.log(`╚════════════════════════════════════════════════════════════╝\n`);

for (const q of testQuestions) {
  const analysis = analyzeComplexity(q);
  const sources = estimateSources(analysis);
  const tools = estimateTools(analysis);

  console.log(formatComplexityReport(q, analysis));
  console.log(`\n`);
}
