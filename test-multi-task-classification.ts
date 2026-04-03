/**
 * Test: Multi-Task Classification Fix
 *
 * Validates that classifyTaskTypes() returns ALL matching task types,
 * not just the first one.
 *
 * Run with: node test-multi-task-classification.ts (after transpiling)
 */

// Mock TaskType definition
type TaskType = 'research' | 'code' | 'analyze' | 'create' | 'file' | 'computer' | 'agents' | 'memory' | 'dataviz' | 'security' | 'architecture' | 'general';

// Inline the classifyTaskTypes implementation (copied from agentEngine.ts)
function classifyTaskTypes(msg: string): TaskType[] {
  const t = msg.toLowerCase();
  const matched = new Set<TaskType>();

  if (/\b(remember|recall|memor|what did i tell|my preference|my goal|save this|note this|your (memories|notes|knowledge)|look at.*(memor|notes|knowledge))\b/.test(t)) matched.add('memory');
  if (/\b(chart|graph|plot|visuali[sz]e|bar chart|line chart|pie chart|scatter|heatmap|histogram|data.*viz|show.*data.*visually|visuali[sz]ation|render.*data|data.*pipeline)\b/.test(t)) matched.add('dataviz');
  if (/\b(show me (stats|numbers|figures|data) (on|for|about))\b/.test(t)) matched.add('dataviz');
  if (/\b(click|screenshot|open (chrome|safari|firefox|finder|a browser|the browser|a tab)|control desktop|automate|use computer|interact with (the |a )?(page|site|browser|desktop)|take a screenshot)\b/.test(t)) matched.add('computer');
  if (/\b(go to|visit|navigate to)\b/.test(t) && /\b(\.com|\.org|\.net|http|www|site|page|url)\b/.test(t)) matched.add('computer');
  if (/\b(security.?audit|vulnerabilit|attack.?surface|cve|owasp|penetration.?test|threat.?model|security.?review|exploit|injection|xss|csrf|auth.?bypass)\b/.test(t)) matched.add('security');
  if (/\b(architecture.?(review|analysis|reasoning)|system.?design|design.?pattern|dependency.?(graph|analysis)|technical.?debt|module.?structure|service.?boundary)\b/.test(t)) matched.add('architecture');
  if (/\b(analyze.*code|code.*analysis|codebase|file.*tree|refactor|optimize.*code|performance.*analysis|code.*review|deep.*dive.*code|understand.*codebase|explain.*structure|pattern.*detection)\b/.test(t)) matched.add('code');
  if (/\b(write.*code|write.*script|function|debug|fix.*bug|implement|program|python|javascript|typescript|bash|shell|command|terminal|npm|pip|git|deploy|build)\b/.test(t)) matched.add('code');
  if (/\b(video|mp4|mov|avi|mkv|webm|trim.*video|cut.*video|edit.*video|analyze.*video|transcri(be|pt)|subtitle|gif.*from|video.*to|audio.*from|extract.*frame|frame.*extract|ffmpeg|whisper|speech.?to.?text|timelapse|slideshow.*video)\b/.test(t)) matched.add('file');
  if (/(\.(pdf|docx|csv|json|txt|xlsx|md)\b|read.*file|open.*file|parse.*file|read.*pdf|open.*pdf|parse.*pdf|extract from.*file)\b/.test(t)) matched.add('file');
  if (/\b(swot|competitor|market|trends|google trends|social media|reddit|twitter|sentiment|brand voice|positioning|landscape)\b/.test(t)) matched.add('analyze');
  if (/\b(write.*post|write.*email|write.*ad|write.*copy|draft|blog|caption|article|essay|report)\b/.test(t)) matched.add('create');
  if (/\b(parallel|simultaneously|at the same time|spawn|multiple agents|subagent|sub.?agent|launch.*(agent|worker)|deploy.*(agent|worker)|send.*(agent|worker)|at once|concurrent|batch.*(research|analy))\b/.test(t)) matched.add('agents');
  if (/\b(research|analyze|analyse|investigate|deep.?dive|comprehensive|in-depth|compare)\b/.test(t)) matched.add('analyze');
  if (/\b(what is|who is|what are|find|look up|search|tell me about|info on|how does|why does|when did|fetch|scrape|grab.*(from|the))\b/.test(t)) matched.add('research');

  return matched.size > 0 ? Array.from(matched) : ['general'];
}

// Test cases
const testCases: Array<{ input: string; expectedTypes: TaskType[]; description: string }> = [
  {
    input: "Research the top 5 AI agents, compare their architectures, then write a blog post about them",
    expectedTypes: ['analyze', 'create'],
    description: "Multi-step: analyze (research) + create (write post)"
  },
  {
    input: "Search for competitors and analyze market sentiment",
    expectedTypes: ['research', 'analyze'],
    description: "Two-task: research (search) + analyze (sentiment)"
  },
  {
    input: "Write some Python code to parse a CSV file and create a visualization",
    expectedTypes: ['code', 'file', 'dataviz'],
    description: "Three-task: code + file + dataviz"
  },
  {
    input: "What is the market landscape? Compare competitors and draft a positioning strategy",
    expectedTypes: ['research', 'analyze', 'create'],
    description: "Natural multi-task: research (what is) + analyze (compare) + create (draft)"
  },
  {
    input: "Search in parallel and spawn agents to analyze results",
    expectedTypes: ['research', 'agents', 'analyze'],
    description: "Parallel + agent execution"
  },
  {
    input: "Tell me about this topic",
    expectedTypes: ['research'],
    description: "Single task: research only"
  },
  {
    input: "Write a blog post",
    expectedTypes: ['create'],
    description: "Single task: create only"
  },
];

// Run tests
console.log("═══════════════════════════════════════════════════════════");
console.log("TEST: Multi-Task Classification");
console.log("═══════════════════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;

testCases.forEach((test, idx) => {
  const result = classifyTaskTypes(test.input);
  const resultSet = new Set(result);
  const expectedSet = new Set(test.expectedTypes);

  const isMatch =
    resultSet.size === expectedSet.size &&
    Array.from(resultSet).every(t => expectedSet.has(t));

  if (isMatch) {
    console.log(`✅ Test ${idx + 1}: PASS`);
    passed++;
  } else {
    console.log(`❌ Test ${idx + 1}: FAIL`);
    failed++;
  }

  console.log(`   Description: ${test.description}`);
  console.log(`   Input: "${test.input}"`);
  console.log(`   Expected: ${JSON.stringify(test.expectedTypes)}`);
  console.log(`   Got:      ${JSON.stringify(result)}`);
  console.log();
});

console.log("═══════════════════════════════════════════════════════════");
console.log(`Results: ${passed} passed, ${failed} failed (${testCases.length} total)`);
console.log("═══════════════════════════════════════════════════════════\n");

if (failed === 0) {
  console.log("🎉 All tests passed! Multi-task classification is working.");
  process.exit(0);
} else {
  console.log(`❌ ${failed} test(s) failed.`);
  process.exit(1);
}
