/**
 * Prompt Parser — Parse markdown research documents
 *
 * Handles 4-page research briefs with embedded constraints:
 * - YAML frontmatter for time/depth/confidence settings
 * - Markdown headings for questions
 * - YouTube/GitHub URL extraction
 * - Topic focus and exclusion lists
 */

import { createLogger } from './logger';

const log = createLogger('prompt-parser');

export interface ParsedPrompt {
  mainQuestion: string;
  subQuestions?: string[];
  constraints: {
    timeLimit?: string;  // '5m', '2h', '12h'
    depthLevel?: string; // 'sq', 'qk', 'nr', 'ex', 'mx'
    maxSources?: number;
    confidenceThreshold?: number;
  };
  resources: {
    youtubeUrls: string[];
    githubRepos: string[];
    customUrls: string[];
  };
  researchFocus?: string[];
  excludeTopics?: string[];
}

export function parsePrompt(content: string): ParsedPrompt {
  try {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    const constraints: ParsedPrompt['constraints'] = {};

    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1];
      const timeMatch = yaml.match(/time:\s*([^\n]+)/);
      const depthMatch = yaml.match(/depth:\s*([^\n]+)/);
      const confMatch = yaml.match(/confidence:\s*([^\n]+)/);
      const sourcesMatch = yaml.match(/max-sources:\s*([^\n]+)/);

      if (timeMatch) constraints.timeLimit = timeMatch[1].trim();
      if (depthMatch) constraints.depthLevel = depthMatch[1].trim().toLowerCase();
      if (confMatch) constraints.confidenceThreshold = parseFloat(confMatch[1]);
      if (sourcesMatch) constraints.maxSources = parseInt(sourcesMatch[1]);
    }

    // Remove frontmatter from content
    const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');

    // Extract main question (first line or first # heading)
    const mainQuestionMatch = contentWithoutFrontmatter.match(/#\s+([^\n]+)/);
    const mainQuestion = mainQuestionMatch
      ? mainQuestionMatch[1].trim()
      : contentWithoutFrontmatter.split('\n')[0].trim();

    // Extract sub-questions (## headings)
    const subQuestionMatches = contentWithoutFrontmatter.matchAll(/##\s+([^\n]+)/g);
    const subQuestions = Array.from(subQuestionMatches).map(m => m[1].trim());

    // Extract YouTube URLs
    const youtubeUrlMatches = contentWithoutFrontmatter.matchAll(
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/g
    );
    const youtubeUrls = Array.from(youtubeUrlMatches).map(m => {
      const videoId = m[1];
      return `https://www.youtube.com/watch?v=${videoId}`;
    });

    // Extract GitHub repos
    const githubRepoMatches = contentWithoutFrontmatter.matchAll(
      /(?:https?:\/\/)?github\.com\/([^\s/]+\/[^\s/]+)/g
    );
    const githubRepos = Array.from(githubRepoMatches).map(m => `https://github.com/${m[1]}`);

    // Extract custom URLs (http/https)
    const customUrlMatches = contentWithoutFrontmatter.matchAll(
      /https?:\/\/[^\s<>"')]+/g
    );
    const customUrls = Array.from(customUrlMatches)
      .map(m => m[0])
      .filter(url => !url.includes('youtube') && !url.includes('github'))
      .filter((url, i, arr) => arr.indexOf(url) === i);  // deduplicate

    // Extract research focus (--- Focus --- section)
    const focusMatch = contentWithoutFrontmatter.match(/---\s*Focus\s*---\n([\s\S]*?)(?=---|$)/i);
    const researchFocus = focusMatch
      ? focusMatch[1].split('\n')
        .map(l => l.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean)
      : undefined;

    // Extract exclude topics
    const excludeMatch = contentWithoutFrontmatter.match(/---\s*Exclude\s*---\n([\s\S]*?)(?=---|$)/i);
    const excludeTopics = excludeMatch
      ? excludeMatch[1].split('\n')
        .map(l => l.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean)
      : undefined;

    const result: ParsedPrompt = {
      mainQuestion,
      subQuestions: subQuestions.length > 0 ? subQuestions : undefined,
      constraints,
      resources: {
        youtubeUrls,
        githubRepos,
        customUrls
      },
      researchFocus,
      excludeTopics
    };

    log.info(`Parsed prompt: "${mainQuestion}" with ${subQuestions.length} sub-questions, ${youtubeUrls.length} videos, ${githubRepos.length} repos`);
    return result;
  } catch (err) {
    log.error('parsePrompt failed:', err);
    return {
      mainQuestion: content.slice(0, 200),
      constraints: {},
      resources: { youtubeUrls: [], githubRepos: [], customUrls: [] }
    };
  }
}

export function validateParsedPrompt(prompt: ParsedPrompt): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!prompt.mainQuestion || prompt.mainQuestion.length < 10) {
    errors.push('Main question must be at least 10 characters');
  }

  if (prompt.constraints.timeLimit) {
    const match = prompt.constraints.timeLimit.match(/^(\d+)([smh])$/);
    if (!match) {
      errors.push(`Invalid time format: "${prompt.constraints.timeLimit}". Use format like "5m", "2h", "30s"`);
    } else {
      const [, amount, unit] = match;
      const minutes = unit === 's' ? parseInt(amount) / 60 : unit === 'h' ? parseInt(amount) * 60 : parseInt(amount);
      if (minutes < 1 || minutes > 1440) {
        errors.push('Time limit must be between 1 minute and 24 hours');
      }
    }
  }

  if (prompt.constraints.depthLevel) {
    const valid = ['sq', 'qk', 'nr', 'ex', 'mx'];
    if (!valid.includes(prompt.constraints.depthLevel)) {
      errors.push(`Invalid depth level: "${prompt.constraints.depthLevel}". Must be one of: ${valid.join(', ')}`);
    }
  }

  if (prompt.constraints.confidenceThreshold !== undefined) {
    if (prompt.constraints.confidenceThreshold < 0 || prompt.constraints.confidenceThreshold > 1) {
      errors.push('Confidence threshold must be between 0 and 1');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function promptParserVersion(): string {
  return '1.0.0';
}
