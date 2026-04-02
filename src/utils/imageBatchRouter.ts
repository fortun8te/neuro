/**
 * ImageBatchRouter — Expose image batch operations via quick menu
 * Handles:
 * - /image-batch [folder | url-list] [options]
 * - --depth [visual|detailed|full]
 * - --filter [product|lifestyle|graphic|logo|packaging]
 * - --colors / --objects / --export [json|markdown]
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface ImageBatchOptions {
  depth?: 'visual' | 'detailed' | 'full';
  filter?: 'product' | 'lifestyle' | 'graphic' | 'logo' | 'packaging';
  colors?: boolean;
  objects?: boolean;
  export?: 'json' | 'markdown' | 'text';
}

export interface ImageBatchResult {
  success: boolean;
  images: string[];
  count: number;
  options: ImageBatchOptions;
  output?: any;
  error?: string;
}

/**
 * Parse /image-batch command arguments.
 * Example: /image-batch ~/screenshots/ --depth detailed --colors --export json
 */
export function parseImageBatchArgs(args: string): { source: string; options: ImageBatchOptions } | null {
  const tokens = args.trim().split(/\s+/);
  if (tokens.length === 0) return null;

  const source = tokens[0];
  const options: ImageBatchOptions = {};

  let i = 1;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '--depth' && i + 1 < tokens.length) {
      const depth = tokens[++i] as 'visual' | 'detailed' | 'full';
      if (['visual', 'detailed', 'full'].includes(depth)) {
        options.depth = depth;
      }
    } else if (token === '--filter' && i + 1 < tokens.length) {
      const filter = tokens[++i] as any;
      if (['product', 'lifestyle', 'graphic', 'logo', 'packaging'].includes(filter)) {
        options.filter = filter;
      }
    } else if (token === '--colors') {
      options.colors = true;
    } else if (token === '--objects') {
      options.objects = true;
    } else if (token === '--export' && i + 1 < tokens.length) {
      const fmt = tokens[++i] as 'json' | 'markdown' | 'text';
      if (['json', 'markdown', 'text'].includes(fmt)) {
        options.export = fmt;
      }
    }

    i++;
  }

  return { source, options };
}

/**
 * Resolve image batch source (folder or URL list file).
 */
export async function resolveImageSource(source: string): Promise<string[] | null> {
  try {
    // Check if it's a URL list file
    if (source.endsWith('.txt') || source.endsWith('.csv')) {
      const fullPath = path.resolve(process.cwd(), source);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && (line.startsWith('http://') || line.startsWith('https://')));
    }

    // Assume it's a folder
    const folderPath = path.resolve(process.cwd(), source);
    const stats = await fs.stat(folderPath);

    if (!stats.isDirectory()) {
      return null;
    }

    const files = await fs.readdir(folderPath);
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

    return files
      .filter(file => imageExts.some(ext => file.toLowerCase().endsWith(ext)))
      .map(file => path.join(folderPath, file));
  } catch {
    return null;
  }
}

/**
 * Build a command string for image batch processing.
 * This would be passed to the image batch service.
 */
export function buildImageBatchCommand(
  images: string[],
  options: ImageBatchOptions
): string {
  const parts = [
    `Analyze ${images.length} images`,
  ];

  if (options.depth) {
    parts.push(`with depth=${options.depth}`);
  }

  if (options.filter) {
    parts.push(`filter by ${options.filter}`);
  }

  if (options.colors) {
    parts.push('extract color palettes');
  }

  if (options.objects) {
    parts.push('detect objects');
  }

  if (options.export) {
    parts.push(`export as ${options.export}`);
  }

  return parts.join(', ');
}

/**
 * Example result formatter for markdown output.
 */
export function formatImageBatchResultMarkdown(
  images: string[],
  options: ImageBatchOptions
): string {
  const lines = [
    '# Image Batch Analysis',
    `## Summary`,
    `- Total images: ${images.length}`,
    `- Depth: ${options.depth || 'visual'}`,
  ];

  if (options.filter) {
    lines.push(`- Filter: ${options.filter}`);
  }

  if (options.colors) {
    lines.push('- Color extraction: enabled');
  }

  if (options.objects) {
    lines.push('- Object detection: enabled');
  }

  lines.push('');
  lines.push('## Images Analyzed');
  images.forEach((img, idx) => {
    lines.push(`${idx + 1}. ${path.basename(img)}`);
  });

  return lines.join('\n');
}
