/**
 * ExecPolicyManager — rule-based approval for shell commands (Codex pattern)
 * Rules loaded from ~/.neuro-cli/exec-rules.json with hot-reload via fs.watch().
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type ExecPolicyAction = 'Allow' | 'Prompt' | 'Forbidden';

export interface ExecRule {
  prefix: string;
  action: ExecPolicyAction;
  reason?: string;
}

export enum ExecApproval {
  Skip,          // Run immediately — whitelisted
  NeedsApproval, // Prompt user
  Forbidden,     // Reject immediately
}

// Built-in safe commands (always Allow)
const SAFE_PREFIXES: ExecRule[] = [
  { prefix: 'git status', action: 'Allow' },
  { prefix: 'git diff', action: 'Allow' },
  { prefix: 'git log', action: 'Allow' },
  { prefix: 'git branch', action: 'Allow' },
  { prefix: 'git show', action: 'Allow' },
  { prefix: 'ls', action: 'Allow' },
  { prefix: 'cat ', action: 'Allow' },
  { prefix: 'head ', action: 'Allow' },
  { prefix: 'tail ', action: 'Allow' },
  { prefix: 'pwd', action: 'Allow' },
  { prefix: 'echo ', action: 'Allow' },
  { prefix: 'which ', action: 'Allow' },
  { prefix: 'find ', action: 'Allow' },
  { prefix: 'grep ', action: 'Allow' },
  { prefix: 'npm run', action: 'Allow' },
  { prefix: 'npx tsc', action: 'Allow' },
  { prefix: 'node --version', action: 'Allow' },
  { prefix: 'npm --version', action: 'Allow' },
];

// Built-in dangerous commands (always Forbidden)
const DANGER_PREFIXES: ExecRule[] = [
  { prefix: 'rm -rf /', action: 'Forbidden', reason: 'Recursive deletion from root is not allowed' },
  { prefix: 'sudo rm', action: 'Forbidden', reason: 'Sudo deletion requires manual execution' },
  { prefix: 'chmod 777', action: 'Forbidden', reason: 'Setting world-writable permissions is dangerous' },
  { prefix: 'curl | bash', action: 'Forbidden', reason: 'Pipe to shell is a security risk' },
  { prefix: 'curl | sh', action: 'Forbidden', reason: 'Pipe to shell is a security risk' },
  { prefix: 'dd if=', action: 'Forbidden', reason: 'Raw disk write is not allowed' },
  { prefix: 'mkfs', action: 'Forbidden', reason: 'Filesystem formatting is not allowed' },
  { prefix: ':(){ :|:& };:', action: 'Forbidden', reason: 'Fork bomb is not allowed' },
];

export class ExecPolicyManager {
  private userRules: ExecRule[] = [];
  private rulesPath: string;
  private watcher: fs.FSWatcher | null = null;

  constructor() {
    this.rulesPath = path.join(os.homedir(), '.neuro-cli', 'exec-rules.json');
    this.loadRules();
  }

  private loadRules(): void {
    try {
      if (fs.existsSync(this.rulesPath)) {
        const content = fs.readFileSync(this.rulesPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          this.userRules = parsed;
        }
      }
    } catch {
      // Rules file missing or malformed — use defaults only
      this.userRules = [];
    }
  }

  startWatching(): void {
    try {
      const dir = path.dirname(this.rulesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.watcher = fs.watch(dir, (eventType, filename) => {
        if (filename === 'exec-rules.json') {
          this.loadRules();
          console.log('[execPolicy] Rules reloaded');
        }
      });
    } catch {
      // Hot-reload unavailable — rules still loaded once at startup
    }
  }

  stopWatching(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  check(command: string): ExecApproval {
    const cmd = command.trim();

    // Check danger list first (highest priority)
    for (const rule of DANGER_PREFIXES) {
      if (cmd.startsWith(rule.prefix) || cmd.includes(rule.prefix)) {
        return ExecApproval.Forbidden;
      }
    }

    // Check user rules (override safe defaults)
    for (const rule of this.userRules) {
      if (cmd.startsWith(rule.prefix)) {
        if (rule.action === 'Allow') return ExecApproval.Skip;
        if (rule.action === 'Forbidden') return ExecApproval.Forbidden;
        return ExecApproval.NeedsApproval;
      }
    }

    // Check safe defaults
    for (const rule of SAFE_PREFIXES) {
      if (cmd.startsWith(rule.prefix)) {
        return ExecApproval.Skip;
      }
    }

    // Default: prompt user for anything not whitelisted
    return ExecApproval.NeedsApproval;
  }

  getDangerReason(command: string): string | undefined {
    const cmd = command.trim();
    for (const rule of DANGER_PREFIXES) {
      if (cmd.startsWith(rule.prefix) || cmd.includes(rule.prefix)) {
        return rule.reason;
      }
    }
    for (const rule of this.userRules) {
      if (cmd.startsWith(rule.prefix) && rule.action === 'Forbidden') {
        return rule.reason;
      }
    }
    return undefined;
  }

  addAllowRule(prefix: string): void {
    this.userRules.unshift({ prefix, action: 'Allow' });
    this.saveRules();
  }

  private saveRules(): void {
    try {
      const dir = path.dirname(this.rulesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.rulesPath, JSON.stringify(this.userRules, null, 2), 'utf-8');
    } catch {
      // Save failed — rules still work in memory
    }
  }
}

export const globalExecPolicy = new ExecPolicyManager();
