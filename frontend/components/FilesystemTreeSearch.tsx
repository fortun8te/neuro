/**
 * FilesystemTreeSearch — File tree with search/filter capability
 * Wraps FilesystemTree with a searchable interface for quick file navigation
 */

import React, { useState, useMemo } from 'react';
import { FilesystemTree, type FilesystemTreeProps, type FileNode } from './FilesystemTree';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';

interface FilesystemTreeSearchProps extends Omit<FilesystemTreeProps, 'nodes'> {
  nodes: FileNode[];
  placeholder?: string;
}

/**
 * Recursively filter file tree by search query
 * Includes a file if its name or any ancestor's name matches
 */
function filterFileTree(nodes: FileNode[], query: string): FileNode[] {
  if (!query.trim()) return nodes;
  const q = query.toLowerCase();

  return nodes
    .map(node => ({
      ...node,
      nodes: node.nodes ? filterFileTree(node.nodes, query) : undefined,
    }))
    .filter(node => {
      const nameMatches = node.name.toLowerCase().includes(q);
      const hasMatchingChildren = node.nodes && node.nodes.length > 0;
      return nameMatches || hasMatchingChildren;
    });
}

export function FilesystemTreeSearch({
  nodes,
  className,
  onFileClick,
  placeholder = 'Search files...',
}: FilesystemTreeSearchProps) {
  const { isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNodes = useMemo(() => {
    return filterFileTree(nodes, searchQuery);
  }, [nodes, searchQuery]);

  const bgColor = isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textColor = isDarkMode ? 'rgba(255,255,255,0.8)' : '#374151';
  const placeholderColor = isDarkMode ? 'rgba(255,255,255,0.4)' : '#9CA3AF';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search input */}
      <div style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${borderColor}`,
        background: bgColor,
      }}>
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${borderColor}`,
            background: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f9fafb',
            color: textColor,
            fontFamily: FONT_FAMILY,
            fontSize: 13,
          }}
        />
      </div>

      {/* File tree */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filteredNodes.length > 0 ? (
          <FilesystemTree
            nodes={filteredNodes}
            className={className}
            onFileClick={onFileClick}
          />
        ) : (
          <div style={{
            padding: '16px 12px',
            textAlign: 'center',
            color: placeholderColor,
            fontSize: 13,
            fontFamily: FONT_FAMILY,
          }}>
            No files match "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
