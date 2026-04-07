#!/usr/bin/env node
const WAYFARER_URL = 'http://localhost:8889';

async function testSearch() {
  console.log('Testing Wayfarer /research endpoint...\n');
  
  const query = "BRICS expansion 2024 geopolitical implications";
  console.log(`Query: "${query}"\n`);
  
  const response = await fetch(`${WAYFARER_URL}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: query,
      num_results: 5,
      concurrency: 10,
    }),
  });

  if (!response.ok) {
    console.log(`ERROR: HTTP ${response.status}`);
    return;
  }

  const data = await response.json();
  
  console.log('SOURCES:');
  if (data.sources && Array.isArray(data.sources)) {
    data.sources.slice(0, 5).forEach((src, i) => {
      console.log(`  [${i+1}] ${typeof src === 'string' ? src : JSON.stringify(src)}`);
    });
  }
  
  console.log('\nTEXT SAMPLE (first 500 chars):');
  console.log(data.text ? data.text.substring(0, 500) : '(empty)');
  
  console.log('\nPAGES COUNT:', (data.pages || []).length);
  console.log('SOURCES COUNT:', (data.sources || []).length);
  console.log('TEXT LENGTH:', (data.text || '').length, 'chars');
}

testSearch().catch(console.error);
