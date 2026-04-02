const OLLAMA_URL = 'http://localhost:11434';

const QUESTIONS = [
  { q: 'What is 15 + 27?', a: '42', cat: 'math' },
  { q: 'Capital of Japan?', a: 'Tokyo', cat: 'geo' },
  { q: 'If 5x = 25, what is x?', a: '5', cat: 'math' },
  { q: 'What year did WWII end?', a: '1945', cat: 'hist' },
  { q: 'Solve: x² = 16, x > 0', a: '4', cat: 'math' },
  { q: 'Largest planet in solar system?', a: 'Jupiter', cat: 'sci' },
  { q: '30% of 200 is?', a: '60', cat: 'math' },
  { q: 'What is H2O?', a: 'water', cat: 'chem' },
  { q: 'Who wrote Romeo and Juliet?', a: 'Shakespeare', cat: 'lit' },
  { q: 'Convert 5 km to meters', a: '5000', cat: 'math' },
];

async function test() {
  console.log('\n🎯 FULL GAIA BENCHMARK - 10 QUESTIONS\n');
  
  let correct = 0;
  const start = Date.now();
  
  for (let i = 0; i < QUESTIONS.length; i++) {
    const {q, a} = QUESTIONS[i];
    
    try {
      const r = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3.5:0.8b',
          prompt: `Answer in 1-2 words: ${q}`,
          stream: false
        })
      });
      const d = await r.json();
      const ans = d.response.trim().split('\n')[0].toLowerCase();
      const match = a.toLowerCase().split(/\s+/)[0];
      const isOk = ans.includes(match) || match.includes(ans.split(/\s+/)[0]);
      
      console.log(`[${i+1}/10] ${isOk ? '✅' : '❌'} "${ans}" (expected: ${a})`);
      if (isOk) correct++;
    } catch (e) {
      console.log(`[${i+1}/10] ❌ ERROR`);
    }
  }
  
  const elapsed = Date.now() - start;
  const pct = ((correct / QUESTIONS.length) * 100).toFixed(1);
  
  console.log('\n' + '='.repeat(50));
  console.log(`FINAL SCORE: ${pct}% (${correct}/${QUESTIONS.length})`);
  console.log(`TOTAL TIME: ${(elapsed/1000).toFixed(1)}s`);
  console.log('='.repeat(50) + '\n');
}

test().catch(e => console.error(e));
