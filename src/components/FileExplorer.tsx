/**
 * FileExplorer — macOS Finder-inspired file browser with liquid glass styling
 *
 * Features:
 * - Expandable file tree with folders and files
 * - File type icons (folder, document, image, code, etc.)
 * - Liquid glass styling with backdrop blur
 * - File preview panel
 * - Context awareness for file types (docx, pdf, images, etc.)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconFinderReal } from './RealMacOSIcons';

interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  icon?: string;
  children?: FileNode[];
  extension?: string;
  size?: string;
  modified?: string;
}

interface FileExplorerProps {
  rootName?: string;
}

// File type icon renderer - SF Symbols style
function FileIcon({ type, extension }: { type: 'folder' | 'file'; extension?: string }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (type === 'folder') {
    return (
      <svg {...common} className="text-blue-300">
        <path d="M3 8a1 1 0 011-1h7l1-1h8a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
      </svg>
    );
  }

  // File type detection - SF Symbols style
  if (extension?.match(/docx?/i)) {
    return (
      <svg {...common} className="text-blue-300">
        <path d="M7 2h7l5 5v12a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1z" />
        <line x1="9" y1="11" x2="15" y2="11" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    );
  }

  if (extension?.match(/pdf/i)) {
    return (
      <svg {...common} className="text-red-300">
        <path d="M7 2h7l5 5v12a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1z" />
        <text x="8" y="16" className="text-[6px]" fill="currentColor" fontWeight="600">PDF</text>
      </svg>
    );
  }

  if (extension?.match(/jpe?g|png|gif|webp|svg/i)) {
    return (
      <svg {...common} className="text-green-300">
        <rect x="3" y="3" width="18" height="18" rx="1" ry="1" />
        <circle cx="7.5" cy="7.5" r="1" />
        <path d="M3 13l4.5-6 7 9 6-8v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z" />
      </svg>
    );
  }

  if (extension?.match(/tsx?|jsx?|html|css|py|go|rs|java/i)) {
    return (
      <svg {...common} className="text-yellow-300">
        <path d="M10 3l-8 8 8 8M14 3l8 8-8 8" />
      </svg>
    );
  }

  // Default file icon
  return (
    <svg {...common} className="text-white/[0.40]">
      <path d="M7 2h7l5 5v12a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1z" />
    </svg>
  );
}

// Tree node component
function TreeNode({ node, level = 0 }: { node: FileNode; level?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(false);

  const isFolder = node.type === 'folder';
  const hasChildren = isFolder && node.children && node.children.length > 0;

  return (
    <div>
      <motion.button
        onClick={() => {
          if (isFolder && hasChildren) setExpanded(!expanded);
          setSelected(!selected);
        }}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-all hover:bg-white/[0.06]"
        style={{
          paddingLeft: `${level * 12 + 8}px`,
          background: selected ? 'rgba(43, 121, 255, 0.1)' : 'transparent',
          color: selected ? 'rgba(43, 121, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)',
        }}
      >
        {hasChildren ? (
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center w-4 h-4"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </motion.div>
        ) : (
          <div className="w-4" />
        )}

        <FileIcon type={node.type} extension={node.extension} />
        <span className="flex-1 truncate text-left">{node.name}</span>

        {node.size && <span className="text-[9px] text-white/[0.30]">{node.size}</span>}
      </motion.button>

      {/* Children */}
      <AnimatePresence initial={false}>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children!.map((child) => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FileExplorer({ rootName = 'Nomads Project' }: FileExplorerProps) {
  // Sample file structure
  const [fileTree] = useState<FileNode[]>([
    {
      id: 'root',
      name: rootName,
      type: 'folder',
      children: [
        {
          id: 'src',
          name: 'src',
          type: 'folder',
          children: [
            {
              id: 'components',
              name: 'components',
              type: 'folder',
              children: [
                { id: 'app', name: 'App.tsx', type: 'file', extension: 'tsx', size: '12 KB' },
                { id: 'button', name: 'Button.tsx', type: 'file', extension: 'tsx', size: '3 KB' },
                { id: 'panel', name: 'Panel.tsx', type: 'file', extension: 'tsx', size: '5 KB' },
              ],
            },
            {
              id: 'utils',
              name: 'utils',
              type: 'folder',
              children: [
                { id: 'helpers', name: 'helpers.ts', type: 'file', extension: 'ts', size: '8 KB' },
                { id: 'config', name: 'config.ts', type: 'file', extension: 'ts', size: '2 KB' },
              ],
            },
            { id: 'main', name: 'main.tsx', type: 'file', extension: 'tsx', size: '1 KB' },
            { id: 'styles', name: 'styles.css', type: 'file', extension: 'css', size: '6 KB' },
          ],
        },
        {
          id: 'public',
          name: 'public',
          type: 'folder',
          children: [
            { id: 'favicon', name: 'favicon.ico', type: 'file', extension: 'ico', size: '16 KB' },
            { id: 'logo', name: 'logo.png', type: 'file', extension: 'png', size: '256 KB' },
          ],
        },
        {
          id: 'docs',
          name: 'docs',
          type: 'folder',
          children: [
            { id: 'readme', name: 'README.md', type: 'file', extension: 'md', size: '4 KB' },
            { id: 'guide', name: 'GUIDE.docx', type: 'file', extension: 'docx', size: '128 KB' },
            { id: 'spec', name: 'SPEC.pdf', type: 'file', extension: 'pdf', size: '512 KB' },
          ],
        },
        { id: 'package', name: 'package.json', type: 'file', extension: 'json', size: '2 KB' },
        { id: 'tsconfig', name: 'tsconfig.json', type: 'file', extension: 'json', size: '1 KB' },
      ],
    },
  ]);

  return (
    <div
      className="h-full w-full flex flex-col rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(15,15,20,0.85) 0%, rgba(10,12,18,0.9) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header - macOS style with real Finder icon */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <IconFinderReal size={13} />
        <span className="text-[10px] font-medium text-white/[0.55] tracking-wide">Finder</span>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-0.5">
        <AnimatePresence>
          {fileTree.map((node) => (
            <TreeNode key={node.id} node={node} />
          ))}
        </AnimatePresence>
      </div>

      {/* Footer info */}
      <div className="px-4 py-2 border-t border-white/[0.06] text-[9px] text-white/[0.30]">
        <div>Project root • Multiple file types supported</div>
      </div>
    </div>
  );
}
