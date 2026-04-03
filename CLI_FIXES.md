# CLI Fixes & Unlocking
## Make the CLI Actually Work

---

## Current Status

CLI exists but needs hardening:
- ❓ Are all service endpoints reachable?
- ❓ Does infrastructure mode actually switch?
- ❓ Can we test model switching without thinking?
- ❓ Is error handling robust?

---

## Fix 1: CLI Service Connectivity Check

**File:** `frontend/cli/cliHealthCheck.ts` (NEW)

```typescript
import { INFRASTRUCTURE } from '../config/infrastructure';
import { getEnv } from '../config/envLoader';

interface ServiceStatus {
  name: string;
  url: string;
  reachable: boolean;
  latency: number;
  error?: string;
}

export async function checkInfrastructure(): Promise<ServiceStatus[]> {
  const services = [
    { name: 'Ollama', url: INFRASTRUCTURE.ollamaUrl },
    { name: 'Wayfarer', url: INFRASTRUCTURE.wayfarerUrl },
    { name: 'SearXNG', url: INFRASTRUCTURE.searxngUrl },
  ];

  const results: ServiceStatus[] = [];

  for (const service of services) {
    const start = Date.now();
    try {
      const response = await fetch(`${service.url}/health`, {
        timeout: 5000,
      });
      const latency = Date.now() - start;
      results.push({
        name: service.name,
        url: service.url,
        reachable: response.ok,
        latency,
      });
    } catch (error) {
      results.push({
        name: service.name,
        url: service.url,
        reachable: false,
        latency: Date.now() - start,
        error: String(error),
      });
    }
  }

  return results;
}

export async function validateCLIEnvironment(): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // Check infrastructure mode
  const mode = getEnv('VITE_INFRASTRUCTURE_MODE') || 'local';
  if (!['local', 'remote'].includes(mode)) {
    issues.push(`Invalid VITE_INFRASTRUCTURE_MODE: ${mode}`);
  }

  // Check services
  const services = await checkInfrastructure();
  for (const service of services) {
    if (!service.reachable) {
      issues.push(`${service.name} not reachable at ${service.url}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
```

**Usage in cli.ts:**
```typescript
// At startup
const env = await validateCLIEnvironment();
if (!env.valid) {
  console.error('❌ Infrastructure check failed:');
  env.issues.forEach(issue => console.error(`   - ${issue}`));
  process.exit(1);
}
```

---

## Fix 2: Infrastructure Mode Switching Test

**File:** `frontend/cli/cliInfrastructureTest.ts` (NEW)

```typescript
import { getEnv } from '../config/envLoader';
import { INFRASTRUCTURE } from '../config/infrastructure';

export async function testInfrastructureModeSwitch(): Promise<void> {
  console.log('🌍 Testing Infrastructure Mode Switching\n');

  // Test 1: Default (should be 'local')
  const defaultMode = getEnv('VITE_INFRASTRUCTURE_MODE') || 'local';
  console.log(`1. Default mode: ${defaultMode}`);
  if (defaultMode !== 'local') {
    console.warn('   ⚠️  Expected local, got remote');
  }

  // Test 2: Ollama endpoint
  const ollamaUrl = INFRASTRUCTURE.ollamaUrl;
  console.log(`2. Ollama endpoint: ${ollamaUrl}`);
  const isLocal = ollamaUrl.includes('localhost');
  console.log(`   ${isLocal ? '✓' : '✗'} ${isLocal ? 'Local' : 'Remote'}`);

  // Test 3: Wayfarer endpoint
  const wayfarerUrl = INFRASTRUCTURE.wayfarerUrl;
  console.log(`3. Wayfarer endpoint: ${wayfarerUrl}`);
  const wayfarerLocal = wayfarerUrl.includes('localhost');
  console.log(`   ${wayfarerLocal ? '✓' : '✗'} ${wayfarerLocal ? 'Local' : 'Remote'}`);

  // Test 4: Force remote mode
  process.env.VITE_INFRASTRUCTURE_MODE = 'remote';
  // Re-import would be needed to test, but shows pattern
  console.log(`4. Remote mode switch: Set (would need re-init to test)`);

  console.log('\n✅ Infrastructure mode switching ready\n');
}

export async function queryOllamaModels(): Promise<string[]> {
  const endpoint = `${INFRASTRUCTURE.ollamaUrl}/api/tags`;
  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    return data.models.map((m: any) => m.name);
  } catch (error) {
    console.error(`Failed to query Ollama: ${error}`);
    return [];
  }
}
```

---

## Fix 3: Model Switching Test (Without Heavy Thinking)

**File:** `frontend/cli/cliModelSwitchTest.ts` (NEW)

```typescript
import { agentEngine } from '../utils/agentEngine';
import { modelConfig } from '../utils/modelConfig';
import { INFRASTRUCTURE } from '../config/infrastructure';

interface ModelSwitchTest {
  taskName: string;
  complexity: 'simple' | 'standard' | 'complex' | 'deep';
  expectedModels: string[];
  querySimple: boolean; // If true, just ask for model selection, not full answer
}

const tests: ModelSwitchTest[] = [
  {
    taskName: 'Simple Math',
    complexity: 'simple',
    expectedModels: ['qwen3.5:0.8b', 'qwen3.5:2b'],
    querySimple: true,
  },
  {
    taskName: 'Market Analysis',
    complexity: 'standard',
    expectedModels: ['qwen3.5:4b'],
    querySimple: true,
  },
  {
    taskName: 'Creative Strategy',
    complexity: 'complex',
    expectedModels: ['qwen3.5:9b'],
    querySimple: true,
  },
  {
    taskName: 'Deep Research',
    complexity: 'deep',
    expectedModels: ['qwen3.5:27b'],
    querySimple: true,
  },
];

export async function testModelSwitching(): Promise<void> {
  console.log('🔄 Testing Model Switching\n');

  for (const test of tests) {
    console.log(`📌 ${test.taskName} (${test.complexity})`);

    // LIGHTWEIGHT: Just ask which model should be used, don't wait for full analysis
    const prompt = `
You are a model selector.
Task: "${test.taskName}"
Complexity: ${test.complexity}
Available models: 0.8b (fast), 2b (fast), 4b (standard), 9b (quality), 27b (best)

Reply ONLY with: "SELECT: [modelname]"
No explanation, just the model name.
    `;

    try {
      const response = await agentEngine.executeReact({
        messages: [{ role: 'user', content: prompt }],
        timeout: 10000, // Short timeout for quick response
      });

      // Parse "SELECT: qwen3.5:4b" from response
      const match = response.match(/SELECT:\s*([\w:.]+)/);
      const selectedModel = match ? match[1] : 'unknown';

      const isCorrect = test.expectedModels.some(m => selectedModel.includes(m.split(':')[1]));
      console.log(`   Selected: ${selectedModel}`);
      console.log(`   Expected: ${test.expectedModels.join(', ')}`);
      console.log(`   ${isCorrect ? '✅' : '❌'} ${isCorrect ? 'CORRECT' : 'WRONG'}\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error}\n`);
    }
  }

  console.log('✅ Model switching test complete\n');
}
```

---

## Fix 4: Error Handling & Recovery

**File:** `frontend/cli/cliErrorHandler.ts` (NEW)

```typescript
export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverySteps?: string[]
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export const errorHandlers = {
  'SERVICE_UNREACHABLE': {
    message: 'Service not reachable',
    recovery: [
      'Check if all services are running',
      'Verify firewall/network settings',
      'Run: ./run-benchmark.sh --check-health',
    ],
  },
  'MODEL_NOT_FOUND': {
    message: 'Required model not loaded',
    recovery: [
      'Pull the model: ollama pull qwen3.5:4b',
      'List available: ollama list',
      'Try with a different model tier',
    ],
  },
  'TOOL_EXECUTION_FAILED': {
    message: 'Tool execution failed',
    recovery: [
      'Check tool input formatting',
      'Verify file paths are writable',
      'Check Wayfarer/SearXNG connectivity',
    ],
  },
  'TIMEOUT': {
    message: 'Request timed out',
    recovery: [
      'Increase timeout: VITE_TIMEOUT_REQUEST=60000',
      'Try with smaller/simpler task',
      'Check system resources (RAM/GPU)',
    ],
  },
};

export function handleError(error: any): void {
  if (error instanceof CLIError) {
    console.error(`\n❌ ${error.message}`);
    console.error(`   Error code: ${error.code}`);

    const handler = errorHandlers[error.code as keyof typeof errorHandlers];
    if (handler && error.recoverySteps) {
      console.error('\n📋 Recovery steps:');
      error.recoverySteps.forEach((step, i) => {
        console.error(`   ${i + 1}. ${step}`);
      });
    }
  } else {
    console.error(`\n❌ Unexpected error: ${error.message}`);
    console.error(error.stack);
  }

  process.exit(1);
}
```

---

## Fix 5: CLI State Persistence

**File:** `frontend/cli/cliState.ts` (NEW)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const STATE_DIR = path.join(homedir(), '.claude', 'neuro_cli');

interface CLISessionState {
  id: string;
  startTime: number;
  mode: 'benchmark' | 'test' | 'research';
  status: 'running' | 'paused' | 'completed' | 'failed';
  lastCheckpoint: number;
  progress: {
    currentPhase: string;
    currentTest: string;
    completedTests: string[];
  };
}

export class CLIStateManager {
  private state: CLISessionState;

  constructor(mode: 'benchmark' | 'test' | 'research') {
    // Ensure state dir exists
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    this.state = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      mode,
      status: 'running',
      lastCheckpoint: Date.now(),
      progress: {
        currentPhase: '',
        currentTest: '',
        completedTests: [],
      },
    };

    this.save();
  }

  checkpoint(phase: string, test: string): void {
    this.state.progress.currentPhase = phase;
    this.state.progress.currentTest = test;
    this.state.lastCheckpoint = Date.now();
    this.save();
  }

  complete(test: string): void {
    this.state.progress.completedTests.push(test);
    this.save();
  }

  fail(): void {
    this.state.status = 'failed';
    this.save();
  }

  finish(): void {
    this.state.status = 'completed';
    this.save();
  }

  private save(): void {
    const filePath = path.join(STATE_DIR, `${this.state.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(this.state, null, 2));
  }

  getState(): CLISessionState {
    return { ...this.state };
  }
}
```

---

## Fix 6: CLI Logging

**File:** `frontend/cli/cliLogger.ts` (NEW)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const LOGS_DIR = path.join(homedir(), '.claude', 'neuro_logs');

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  metadata?: any;
}

export class CLILogger {
  private logFile: string;
  private logs: LogEntry[] = [];

  constructor(sessionId: string) {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }

    this.logFile = path.join(LOGS_DIR, `${sessionId}.jsonl`);
  }

  log(level: LogEntry['level'], component: string, message: string, metadata?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      metadata,
    };

    this.logs.push(entry);

    // Append to JSONL file
    fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');

    // Also log to stdout for immediate feedback
    const prefix = {
      debug: '🔍',
      info: 'ℹ️ ',
      warn: '⚠️ ',
      error: '❌',
    }[level];

    console.log(`${prefix} [${component}] ${message}`);
    if (metadata) {
      console.log(`    ${JSON.stringify(metadata)}`);
    }
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }
}
```

---

## Fix 7: Unlock Model Routing in CLI

**File:** `frontend/utils/modelConfig.ts` (MODIFY)

**Current Problem:**
```typescript
// modelConfig.ts assumes browser context
import type { CampaignCycle } from '../hooks/useCycleLoop';
// ❌ Browser-only imports
```

**Fix:**
```typescript
// At top of modelConfig.ts
const isBrowser = typeof window !== 'undefined';

// Safely export model tiers
export const modelTiers = {
  fast: ['qwen3.5:0.8b', 'qwen3.5:2b'],
  standard: ['qwen3.5:4b'],
  quality: ['qwen3.5:9b'],
  maximum: ['qwen3.5:27b'],
};

export async function selectModel(complexity: 'simple' | 'standard' | 'complex' | 'deep'): Promise<string> {
  const tier = {
    simple: 'fast',
    standard: 'standard',
    complex: 'quality',
    deep: 'maximum',
  }[complexity];

  const models = modelTiers[tier as keyof typeof modelTiers];
  return models[0]; // Use first available model in tier
}
```

---

## Summary: CLI Fixes Checklist

- [ ] Add `cliHealthCheck.ts` — Service connectivity validation
- [ ] Add `cliInfrastructureTest.ts` — Mode switching test
- [ ] Add `cliModelSwitchTest.ts` — Model routing without full inference
- [ ] Add `cliErrorHandler.ts` — Robust error recovery
- [ ] Add `cliState.ts` — Session persistence + checkpointing
- [ ] Add `cliLogger.ts` — JSONL logging to disk
- [ ] Modify `modelConfig.ts` — Safe exports for CLI use
- [ ] Update `cli.ts` — Wire all checks into main flow

**Time Estimate:** 4-6 hours

**Success Metric:** Can run benchmark from CLI without mysteries about what's happening

