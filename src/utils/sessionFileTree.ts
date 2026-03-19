/**
 * sessionFileTree — Generate a file tree for the current session
 *
 * Shows the agent a structured view of session files and directories
 */

import type { FileNode } from '../components/FileTree';

/**
 * Generate a mock session file tree
 * In a real implementation, this would read from the actual file system
 */
export function generateSessionFileTree(machineId: string): FileNode[] {
  const timestamp = new Date().toISOString().split('T')[0];

  return [
    {
      id: 'session-root',
      name: `session-${machineId}`,
      type: 'folder',
      children: [
        {
          id: 'downloads',
          name: 'Downloads',
          type: 'folder',
          children: [
            { id: 'downloads-1', name: 'chrome-search-results.txt', type: 'file' },
            { id: 'downloads-2', name: 'competitor-analysis.pdf', type: 'file' },
            { id: 'downloads-3', name: 'market-data.csv', type: 'file' },
          ],
        },
        {
          id: 'documents',
          name: 'Documents',
          type: 'folder',
          children: [
            { id: 'docs-1', name: 'campaign-brief.md', type: 'file' },
            { id: 'docs-2', name: 'brand-guidelines.txt', type: 'file' },
            { id: 'docs-3', name: 'research-notes.md', type: 'file' },
          ],
        },
        {
          id: 'tasks',
          name: 'Tasks',
          type: 'folder',
          children: [
            {
              id: 'completed',
              name: 'Completed',
              type: 'folder',
              children: [
                { id: 'task-1', name: `research-${timestamp}.txt`, type: 'file' },
                { id: 'task-2', name: `analysis-${timestamp}.md`, type: 'file' },
              ],
            },
            {
              id: 'in-progress',
              name: 'In Progress',
              type: 'folder',
              children: [
                { id: 'task-3', name: 'creative-brainstorm.txt', type: 'file' },
                { id: 'task-4', name: 'audience-research.md', type: 'file' },
              ],
            },
          ],
        },
        {
          id: 'cache',
          name: '.cache',
          type: 'folder',
          children: [
            { id: 'cache-1', name: 'web-screenshots', type: 'folder' },
            { id: 'cache-2', name: 'compressed-results.bin', type: 'file' },
          ],
        },
      ],
    },
  ];
}

/**
 * Get a text representation of the file tree for display in agent context
 */
export function fileTreeToString(nodes: FileNode[], indent = 0): string {
  return nodes
    .map((node) => {
      const prefix = ' '.repeat(indent * 2);
      const icon = node.type === 'folder' ? '📁' : '📄';
      const line = `${prefix}${icon} ${node.name}`;

      if (node.children && node.children.length > 0) {
        return `${line}\n${fileTreeToString(node.children, indent + 1)}`;
      }

      return line;
    })
    .join('\n');
}
