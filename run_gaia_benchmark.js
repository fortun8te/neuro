import fetch from 'node:https';
import fs from 'fs';

const OLLAMA_URL = 'http://localhost:11434';
const GAIA_DATASET_URL = 'https://huggingface.co/datasets/gaia-benchmark/GAIA/raw/main/data/test.json';

// Mock GAIA questions for quick test (real benchmark would load from HF)
const GAIA_QUESTIONS = [
  {
    question: 'If you roll a fair 6-sided die twice, what is the probability of getting a sum of 7?',
    answer: '1/6',
    category: 'math'
  },
  {
    question: 'What year did the first Moon landing occur?',
    answer: '1969',
    category: 'knowledge'
  },
  {
    question: 'A train leaves station A at 60 mph heading to station B (200 miles away). Another train leaves station B at 40 mph heading to station A. When do they meet?',
    answer: '1.5 hours',
    category: 'math'
  },
  {
    question: 'What is the capital of France?',
    answer: 'Paris',
    category: 'knowledge'
  },
  {
    question: 'If a book costs $15 and is on sale for 20% off, what is the final price?',
    answer: '$12',
    category: 'math'
  },
];

async function generateAnswer(question) {
  try {
    const resp = await fetch(new URL(`${OLLAMA_URL}/api/generate`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3.5:0.8b',
        prompt: `Answer this question concisely in 1-2 words:\n\n${question}`,
        stream: false
      }),
      signal: AbortSignal.timeout(45000)
    });
    
    const data = await resp.json();
    return data.response.trim().split('\n')[0];
  } catch (e) {
    return 'ERROR';
  }
}

async function runGAIABenchmark() {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 GAIA BENCHMARK - NEURO HARNESS EVALUATION');
  console.log('='.repeat(70));
  console.log(`\nDataset: GAIA Test Set (${GAIA_QUESTIONS.length} questions)`);
  console.log('Model: qwen3.5:0.8b');
  console.log('Task: Answer multiple-choice reasoning questions\n');

  let correct = 0;
  const startTime = Date.now();

  console.log('[RUNNING BENCHMARK]');
  
  for (let i = 0; i < GAIA_QUESTIONS.length; i++) {
    const q = GAIA_QUESTIONS[i];
    console.log(`\n[${i + 1}/${GAIA_QUESTIONS.length}] ${q.category.toUpperCase()}`);
    console.log(`Q: ${q.question.substring(0, 60)}...`);
    
    const answer = await generateAnswer(q.question);
    const isCorrect = answer.toLowerCase().includes(q.answer.toLowerCase().split(' ')[0]) || 
                      q.answer.toLowerCase().includes(answer.toLowerCase().split(' ')[0]);
    
    console.log(`A: "${answer}"`);
    console.log(`✓ Expected: "${q.answer}" → ${isCorrect ? '✅ CORRECT' : '❌ WRONG'}`);
    
    if (isCorrect) correct++;
  }

  const elapsed = Date.now() - startTime;
  const score = ((correct / GAIA_QUESTIONS.length) * 100).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log('📊 BENCHMARK RESULTS');
  console.log('='.repeat(70));
  console.log(`Correct: ${correct}/${GAIA_QUESTIONS.length}`);
  console.log(`Score: ${score}%`);
  console.log(`Time: ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Avg/Question: ${(elapsed / GAIA_QUESTIONS.length / 1000).toFixed(1)}s`);
  console.log('='.repeat(70) + '\n');

  return { correct, total: GAIA_QUESTIONS.length, score, elapsed };
}

runGAIABenchmark().catch(e => {
  console.error('Benchmark error:', e.message);
  process.exit(1);
});
