/**
 * Code Analysis Agent — Deep code reasoning using Nemotron-3-Super
 * Provides:
 * - Codebase structure analysis
 * - Deep architectural understanding
 * - File relationship mapping
 * - Performance/security insights
 * - Refactoring recommendations
 */

import { ollamaService } from './ollama';
import { getModelForStage } from './modelConfig';
import { createLogger } from './logger';
import { vfs } from './sessionFileSystem';
import type { VFSNode } from './sessionFileSystem';

const log = createLogger('code-analysis');

export interface CodeAnalysisResult {
  summary: string;
  structure: {
    totalFiles: number;
    mainDirs: string[];
    keyFiles: string[];
    architecture: string;
  };
  insights: {
    patterns: string[];
    dependencies: string[];
    improvements: string[];
  };
  recommendations: string[];
  durationMs: number;
}

export interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  size?: number;
  isKey?: boolean;
}

/**
 * Analyze codebase structure and provide deep insights
 */
export async function analyzeCodebase(
  rootPath: string = '/nomad',
  maxDepth: number = 4,
  signal?: AbortSignal
): Promise<CodeAnalysisResult> {
  const startTime = Date.now();
  try {
    // 1. Build file tree
    const fileTree = await buildFileTree(rootPath, maxDepth);

    // 2. Extract key files and structure
    const { keyFiles, mainDirs, totalFiles } = extractStructure(fileTree);

    // 3. Read key files for context
    const context = await buildContextFromKeyFiles(keyFiles, rootPath);

    // 4. Use Nemotron for deep analysis
    const model = getModelForStage('production'); // nemotron-3-super or fallback

    const systemPrompt = 'You are a senior software architect and code reviewer. Provide insightful analysis.';

    const prompt = `Analyze this codebase structure:

Total Files: ${totalFiles}
Key Directories: ${mainDirs.join(', ')}
Key Files: ${keyFiles.join(', ')}

Key File Previews:
${context}

Respond ONLY with a JSON object (no markdown, no extra text):
{
  "summary": "Brief codebase description",
  "architecture": "Architecture pattern (e.g., MVC, microservices, component-based)",
  "patterns": ["Pattern 1", "Pattern 2"],
  "dependencies": ["Dep 1", "Dep 2"],
  "improvements": ["Improvement 1", "Improvement 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

    let fullResponse = '';

    await ollamaService.generateStream(
      prompt,
      systemPrompt,
      {
        model,
        temperature: 0.3,
        num_predict: 2000,
        onChunk: (chunk: string) => { fullResponse += chunk; },
        signal,
      }
    );

    // Parse response
    const analysis: CodeAnalysisResult['insights'] & {
      summary: string;
      architecture: string;
      recommendations: string[];
    } = {
      summary: 'Codebase analyzed',
      architecture: 'Multi-layered',
      patterns: [],
      dependencies: [],
      improvements: [],
      recommendations: [],
    };

    try {
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, any>;
        if (typeof parsed.summary === 'string') analysis.summary = parsed.summary;
        if (typeof parsed.architecture === 'string') analysis.architecture = parsed.architecture;
        if (Array.isArray(parsed.patterns)) analysis.patterns = parsed.patterns;
        if (Array.isArray(parsed.dependencies)) analysis.dependencies = parsed.dependencies;
        if (Array.isArray(parsed.improvements)) analysis.improvements = parsed.improvements;
        if (Array.isArray(parsed.recommendations)) analysis.recommendations = parsed.recommendations;
      }
    } catch (e) {
      log.warn('Failed to parse analysis JSON', {}, e);
      // Keep defaults
    }

    return {
      summary: analysis.summary,
      structure: {
        totalFiles,
        mainDirs,
        keyFiles,
        architecture: analysis.architecture,
      },
      insights: {
        patterns: analysis.patterns,
        dependencies: analysis.dependencies,
        improvements: analysis.improvements,
      },
      recommendations: analysis.recommendations,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    log.error('Codebase analysis failed', {}, error);
    throw error;
  }
}

/**
 * Build a file tree representation
 */
async function buildFileTree(
  dirPath: string,
  maxDepth: number,
  currentDepth: number = 0
): Promise<FileTreeNode> {
  if (currentDepth >= maxDepth) {
    return { name: dirPath, type: 'folder', children: [] };
  }

  try {
    const contents = vfs.listFolder(dirPath);
    const children: FileTreeNode[] = [];

    // Sort: folders first, then key files
    const keyFilePatterns = [
      'package.json', 'tsconfig.json', 'vite.config', 'index', 'main',
      'app.', 'config.', 'env.', 'README', '.env',
    ];

    const isKeyFile = (name: string) =>
      keyFilePatterns.some(kf => name.includes(kf));

    const sorted = [...contents].sort((a, b) => {
      // Folders first
      if ((a.type === 'folder') !== (b.type === 'folder')) {
        return a.type === 'folder' ? -1 : 1;
      }
      // Then key files
      const aKey = isKeyFile(a.name);
      const bKey = isKeyFile(b.name);
      if (aKey !== bKey) return aKey ? -1 : 1;
      // Then alphabetical
      return a.name.localeCompare(b.name);
    });

    // Limit to avoid explosion
    const itemLimit = currentDepth === 0 ? 20 : 10;
    for (const item of sorted.slice(0, itemLimit)) {
      const childPath = `${dirPath}/${item.name}`;

      if (item.type === 'folder') {
        const subtree = await buildFileTree(childPath, maxDepth, currentDepth + 1);
        children.push(subtree);
      } else {
        children.push({
          name: item.name,
          type: 'file',
          isKey: isKeyFile(item.name),
        });
      }
    }

    return {
      name: dirPath.split('/').pop() || 'root',
      type: 'folder',
      children,
    };
  } catch (error) {
    log.warn(`Failed to read directory ${dirPath}`, {}, error);
    return { name: dirPath, type: 'folder', children: [] };
  }
}

/**
 * Extract key information from file tree
 */
function extractStructure(tree: FileTreeNode): {
  keyFiles: string[];
  mainDirs: string[];
  totalFiles: number;
} {
  const keyFiles: string[] = [];
  const mainDirs: string[] = [];
  let totalFiles = 0;

  function walk(node: FileTreeNode, pathPrefix: string = '') {
    if (node.type === 'file') {
      totalFiles++;
      if (node.isKey) {
        keyFiles.push(`${pathPrefix}${node.name}`);
      }
    } else if (node.children) {
      if (pathPrefix === '') {
        mainDirs.push(node.name);
      }
      for (const child of node.children) {
        walk(child, `${pathPrefix}${node.name}/`);
      }
    }
  }

  walk(tree);
  return { keyFiles: keyFiles.slice(0, 15), mainDirs: mainDirs.slice(0, 8), totalFiles };
}

/**
 * Read and summarize key files
 */
async function buildContextFromKeyFiles(
  keyFiles: string[],
  rootPath: string
): Promise<string> {
  const context: string[] = [];

  for (const file of keyFiles.slice(0, 5)) {
    try {
      const node = vfs.readFile(file);
      if (node && node.data) {
        const preview = typeof node.data === 'string'
          ? node.data.slice(0, 1000)
          : JSON.stringify(node.data).slice(0, 1000);
        context.push(`\n=== ${file} ===\n${preview}...`);
      }
    } catch (e) {
      // Silently skip
    }
  }

  return context.join('\n');
}

/**
 * Generate ASCII tree representation for display
 */
export function formatFileTree(node: FileTreeNode, indent: string = ''): string {
  const icon = node.type === 'folder' ? '📁' : '📄';
  const lines = [`${indent}${icon} ${node.name}`];

  if (node.children && node.children.length > 0) {
    const childCount = node.children.length;
    node.children.forEach((child, idx) => {
      const isLast = idx === childCount - 1;
      const newIndent = indent + (isLast ? '  ' : '  │ ');
      const prefix = isLast ? '└─ ' : '├─ ';

      const childLines = formatFileTree(child, newIndent);
      const childLinesArr = childLines.split('\n');
      lines.push(prefix + childLinesArr[0].replace(/^[\s│├└─]*/, ''));
      if (childLinesArr.length > 1) {
        lines.push(...childLinesArr.slice(1));
      }
    });
  }

  return lines.join('\n');
}
