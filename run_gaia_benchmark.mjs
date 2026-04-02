const OLLAMA_URL = 'http://localhost:11434';

const GAIA_QUESTIONS = [
  { question: 'If you roll a fair die twice, probability of sum 7?', answer: '1/6', category: 'math' },
  { question: 'What year was the Moon landing?', answer: '1969', category: 'knowledge' },
  { question: 'A train leaves at 60mph to 200mi station. Another at 40mph opposite. When meet?', answer: '1.5', category: 'math' },
  { question: 'What is the capital of France?', answer: 'Paris', category: 'knowledge' },
  { question: 'Book costs $15, 20% off. Final price?', answer: '$12', category: 'math' },
];

async function generateAnswer(question) {
  try {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3.5:0.8b',
        prompt: `Answer concisely in 1-2 words:\n\n${question}`,
        stream: false,
        options: { num_predict: 20 }
      })
    });
    const data = await resp.json();
    return data.response.trim().split('\n')[0].trim();
  } catch (e) {
    return 'ERROR';
  }
}

async function runGAIA() {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 GAIA BENCHMARK - NEURO HARNESS');
  console.log('='.repeat(70));
  console.log(`Questions: ${GAIA_QUESTIONS.length} | Model: qwen3.5:0.8b\n`);

  let correct = 0;
  const startTime = Date.now();

  for (let i = 0; i < GAIA_QUESTIONS.length; i++) {
    const q = GAIA_QUESTIONS[i];
    console.log(`[${i+1}/5] ${q.category.toUpperCase()}`);
    console.log(`Q: ${q.question.substring(0, 60)}...`);
    
    const answer = await generateAnswer(q.question);
    const ansKey = q.answer.toLowerCase().split(/\s+/)[0];
    const respKey = answer.toLowerCase().split(/\s+/)[0];
    const isCorrect = ansKey === respKey || answer.includes(q.answer) || q.answer.includes(answer);
    
    console.log(`A: "${answer}"`);
    console.log(`Expected: "${q.answer}" → ${isCorrect ? '✅' : '❌'}\n`);
    
    if (isCorrect) correct++;
  }

  const elapsed = Date.now() - startTime;
  const score = ((correct / GAIA_QUESTIONS.length) * 100).toFixed(1);

  console.log('='.repeat(70));
  console.log(`SCORE: ${score}% (${correct}/${GAIA_QUESTIONS.length} correct)`);
  console.log(`TIME: ${(elapsed/1000).toFixed(1)}s total | ${(elapsed/GAIA_QUESTIONS.length/1000).toFixed(1)}s/q`);
  console.log('='.repeat(70) + '\n');
}

runGAIA().catch(e => console.error('Error:', e.message));
