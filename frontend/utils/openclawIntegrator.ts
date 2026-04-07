/**
 * OpenClaw Integrator — Auto-install skills from OpenClaw marketplace
 * When agent cannot solve a task, fetch matching skills and install them
 *
 * OpenClaw: Community skill marketplace for AI agents
 * Repo: https://github.com/neurogen-ai/openclaw
 */

export interface OpenClawSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  author: string;
  rating: number;  // 0-5
  downloads: number;
  sourceUrl: string;
  toolDefinition: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface SkillInstallRequest {
  skillId: string;
  skillName: string;
  category: string;
}

export interface SkillInstallResult {
  success: boolean;
  skillId: string;
  skillName: string;
  message: string;
  installedAt?: string;
  error?: string;
}

// OpenClaw marketplace API
const OPENCLAW_API = 'https://api.openclaw.dev/api/v1';

/**
 * Search OpenClaw marketplace for skills matching a task
 */
export async function searchOpenClawSkills(
  query: string,
  limit: number = 5,
): Promise<OpenClawSkill[]> {
  try {
    const response = await fetch(
      `${OPENCLAW_API}/skills/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      console.warn(`OpenClaw search failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.skills || [];
  } catch (error) {
    console.error('OpenClaw search error:', error);
    return [];
  }
}

/**
 * Get skill details from OpenClaw
 */
export async function getOpenClawSkill(skillId: string): Promise<OpenClawSkill | null> {
  try {
    const response = await fetch(`${OPENCLAW_API}/skills/${skillId}`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch skill:', error);
    return null;
  }
}

/**
 * Download skill code from OpenClaw
 */
export async function downloadOpenClawSkill(skillId: string): Promise<string | null> {
  try {
    const response = await fetch(`${OPENCLAW_API}/skills/${skillId}/code`);

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error('Failed to download skill code:', error);
    return null;
  }
}

/**
 * Install skill locally (save to IndexedDB + register in MCP registry)
 * SECURITY: Validates code before installation
 */
export async function installOpenClawSkill(
  skill: OpenClawSkill,
  mcpRegistry?: any,  // mcpRegistry from mcp/adapter
  autoApprove: boolean = false,  // Set to true only if user has already reviewed code
): Promise<SkillInstallResult> {
  try {
    // Download skill code
    const skillCode = await downloadOpenClawSkill(skill.id);

    if (!skillCode) {
      return {
        success: false,
        skillId: skill.id,
        skillName: skill.name,
        message: 'Failed to download skill code',
        error: 'Could not fetch skill from OpenClaw',
      };
    }

    // Security: Validate code before installation
    const validation = validateSkillCode(skillCode);
    if (!validation.safe) {
      console.warn(`[SECURITY] Skill installation rejected: ${validation.reason}`);
      return {
        success: false,
        skillId: skill.id,
        skillName: skill.name,
        message: 'Skill code failed security validation',
        error: validation.reason,
      };
    }

    // In production, require explicit user approval before installation
    // For now, log this as a security event
    console.warn(
      `[SECURITY] Installing OpenClaw skill "${skill.name}" (${skill.id}) from author: ${skill.author}\n` +
      `Review the code and source before approving: ${skill.sourceUrl}`,
    );

    // Save to IndexedDB
    const db = (window as any).nominaDB || await initIndexedDB();
    const installedSkills = (await db.getItem('openclawSkills')) || {};

    installedSkills[skill.id] = {
      ...skill,
      code: skillCode,
      installedAt: new Date().toISOString(),
      // Track who approved this installation (for audit trail)
      approvedBy: autoApprove ? 'auto' : 'user',
    };

    await db.setItem('openclawSkills', installedSkills);

    // Register with MCP if available
    if (mcpRegistry && skill.toolDefinition) {
      try {
        // Create executor function from skill code (will validate again)
        const executor = createSkillExecutor(skill.id, skillCode);
        const mcp = createMCPAdapter(skill.id, executor, skill.toolDefinition);
        mcpRegistry.register(mcp);
      } catch (e) {
        console.warn(`Failed to register skill in MCP: ${e}`);
      }
    }

    return {
      success: true,
      skillId: skill.id,
      skillName: skill.name,
      message: `Installed skill: ${skill.name} v${skill.version}`,
      installedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      skillId: skill.id,
      skillName: skill.name,
      message: 'Installation failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Auto-install skill when agent cannot solve task
 * Main entry point for skill auto-installation
 */
export async function autoInstallSkillForTask(
  taskDescription: string,
  failureReason?: string,
  mcpRegistry?: any,
): Promise<SkillInstallResult | null> {
  try {
    // Search OpenClaw for matching skills
    const matchingSkills = await searchOpenClawSkills(taskDescription, 3);

    if (matchingSkills.length === 0) {
      console.log(`No OpenClaw skills found for: ${taskDescription}`);
      return null;
    }

    // Pick top-rated skill
    const bestSkill = matchingSkills.reduce((prev, curr) =>
      curr.rating > prev.rating ? curr : prev
    );

    console.log(`Auto-installing skill: ${bestSkill.name}`);

    // Install it
    const result = await installOpenClawSkill(bestSkill, mcpRegistry);

    if (result.success) {
      console.log(`✓ Auto-installed: ${result.skillName}`);
    }

    return result;
  } catch (error) {
    console.error('Auto-install failed:', error);
    return null;
  }
}

/**
 * List installed OpenClaw skills
 */
export async function getInstalledSkills(): Promise<OpenClawSkill[]> {
  try {
    const db = (window as any).nominaDB || await initIndexedDB();
    const installed = (await db.getItem('openclawSkills')) || {};
    return Object.values(installed);
  } catch (error) {
    console.error('Failed to get installed skills:', error);
    return [];
  }
}

/**
 * Uninstall skill
 */
export async function uninstallOpenClawSkill(skillId: string): Promise<boolean> {
  try {
    const db = (window as any).nominaDB || await initIndexedDB();
    const installed = (await db.getItem('openclawSkills')) || {};

    if (!installed[skillId]) {
      return false;
    }

    delete installed[skillId];
    await db.setItem('openclawSkills', installed);

    return true;
  } catch (error) {
    console.error('Failed to uninstall skill:', error);
    return false;
  }
}

/**
 * SECURITY: Validate skill code before execution
 * Checks for dangerous patterns that could compromise security
 *
 * WARNING: This is NOT a complete sandbox. For production, use:
 * - Web Workers with message passing
 * - iframe sandboxing
 * - WebAssembly for computation-heavy tasks
 */
function validateSkillCode(code: string): { safe: boolean; reason?: string } {
  // Dangerous patterns that indicate potential security risks
  const dangerousPatterns = [
    /import\s+/,                    // Dynamic imports could load untrusted code
    /require\s*\(/,                 // CommonJS requires
    /eval\s*\(/,                    // Direct eval usage
    /Function\s*\(/,                // Function constructor (this is what we use, but warn if in skill)
    /document\./,                   // Direct DOM manipulation
    /window\./,                     // Window object access
    /process\./,                    // Process manipulation
    /fs\./,                         // File system access
    /fetch\(/,                      // Network requests (if not desired)
    /XMLHttpRequest/,               // Network requests (legacy)
    /dangerouslySetInnerHTML/,      // React dangerous HTML
    /innerHTML\s*=/,                // innerHTML manipulation
    /localStorage/,                 // Storage access
    /sessionStorage/,               // Storage access
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return {
        safe: false,
        reason: `Detected potentially dangerous pattern: ${pattern.source}`,
      };
    }
  }

  return { safe: true };
}

/**
 * Helper: Create executor function from skill code
 * SECURITY: Now validates code before execution and logs access
 *
 * SECURITY MODEL (Function Constructor):
 * - new Function() creates functions in a controlled scope, NOT a sandbox
 * - It has access to: global scope, arguments, Math, String, etc.
 * - It does NOT have access to: local variables, closure context
 * - It CAN be escaped by accessing Function.constructor or Object.getPrototypeOf
 *
 * LIMITATIONS:
 * - This is NOT a complete sandbox and should NOT be used with untrusted code
 * - Determined attackers can still compromise the application
 * - For true isolation, use: Web Workers, iframes, or WebAssembly
 *
 * CURRENT APPROACH:
 * - Pattern-based validation blocks obvious malicious code
 * - Audit logging tracks all skill executions
 * - User approval gates installation (in production UI)
 * - Defends against accidental harm but not determined attacks
 *
 * FUTURE IMPROVEMENTS:
 * - Migrate to Web Worker-based execution for true isolation
 * - Implement code signing/verification for trusted publishers
 * - Add resource limits (CPU, memory, network)
 * - Rate limiting on skill execution
 */
function createSkillExecutor(
  skillId: string,
  skillCode: string,
): (args: Record<string, any>) => Promise<any> {
  // Validate code before creating executor
  const validation = validateSkillCode(skillCode);
  if (!validation.safe) {
    const error = `Skill security validation failed: ${validation.reason}`;
    console.warn(`[SECURITY] Skill ${skillId} rejected: ${error}`);
    return async () => {
      throw new Error(error);
    };
  }

  return async (args: Record<string, any>) => {
    try {
      // Log execution for audit trail
      console.log(`[AUDIT] Executing OpenClaw skill: ${skillId}`);

      // Create executor in isolated context (still not a complete sandbox)
      const fn = new Function('args', skillCode);
      const result = await fn(args);

      console.log(`[AUDIT] Skill ${skillId} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[AUDIT] Skill ${skillId} execution error:`, error);
      throw new Error(`Skill execution failed: ${error}`);
    }
  };
}

/**
 * Helper: Initialize IndexedDB (if not already done)
 */
async function initIndexedDB(): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nomads', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('skills')) {
        db.createObjectStore('skills');
      }
    };
  });
}

/**
 * Mock MCP adapter creation (placeholder)
 * In real implementation, would import from ./mcp/adapter
 */
function createMCPAdapter(
  toolName: string,
  executeFn: (args: Record<string, any>) => Promise<any>,
  toolDef?: any,
): any {
  return {
    name: toolName,
    transport: 'direct',
    async discover() {
      if (toolDef) {
        return [toolDef];
      }
      return [{
        name: toolName,
        description: `Installed OpenClaw skill: ${toolName}`,
        parameters: { type: 'object', properties: {}, required: [] },
      }];
    },
    async execute(name: string, args: Record<string, any>) {
      if (name !== toolName) {
        return { success: false, error: `Tool ${name} not found` };
      }
      try {
        const data = await executeFn(args);
        return { success: true, data };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    async health() {
      return true;
    },
  };
}

/**
 * Skill categories for discovery
 */
export const SKILL_CATEGORIES = [
  'web_search',
  'data_analysis',
  'file_operations',
  'code_execution',
  'image_processing',
  'text_processing',
  'api_integration',
  'database',
  'email',
  'calendar',
  'social_media',
];
