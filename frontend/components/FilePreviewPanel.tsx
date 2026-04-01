// @ts-nocheck
/**
 * FilePreviewPanel — Live file preview with agent cursor
 *
 * Shows when the agent writes a file. Streams content character by character
 * with a blinking blue cursor at the write position, Manus-style.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import hljs from 'highlight.js';

export interface PreviewFile {
  id: string;
  filename: string;
  content: string;       // final content (set when tool_done fires)
  isWriting: boolean;    // true while tool is running
  savedAt?: number;
  language?: string;
}

interface FilePreviewPanelProps {
  files: PreviewFile[];
  onClose: () => void;
  isDark?: boolean;
}

// Infer language from filename extension
function inferLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', md: 'markdown', json: 'json', css: 'css', html: 'html',
    sh: 'bash', yml: 'yaml', yaml: 'yaml', sql: 'sql', rs: 'rust',
    go: 'go', java: 'java', cpp: 'cpp', c: 'c', rb: 'ruby', php: 'php',
    txt: 'plaintext', csv: 'plaintext', xml: 'xml',
  };
  return map[ext] || 'plaintext';
}

// Syntax highlight a code string
function highlight(code: string, lang: string): string {
  try {
    if (lang === 'plaintext') return escapeHtml(code);
    const result = hljs.highlight(code, { language: lang, ignoreIllegals: true });
    return result.value;
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Characters revealed per animation frame
const CHARS_PER_TICK = 6;
const TICK_MS = 12; // ~80 chars/second — fast enough to feel live

function FileTab({ file, active, onClick }: { file: PreviewFile; active: boolean; onClick: () => void }) {
  const ext = file.filename.split('.').pop() || '';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px',
        borderBottom: active ? '2px solid rgba(59,130,246,0.85)' : '2px solid transparent',
        background: active ? 'rgba(59,130,246,0.06)' : 'transparent',
        color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
        fontSize: 11, fontFamily: "'DM Mono', 'JetBrains Mono', monospace",
        cursor: 'pointer', borderRadius: 0, flexShrink: 0, whiteSpace: 'nowrap',
        transition: 'all 0.12s',
      }}
    >
      <span style={{ fontSize: 9, opacity: 0.6, fontFamily: 'monospace' }}>.{ext}</span>
      {file.filename.split('/').pop()}
      {file.isWriting && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: 'rgba(59,130,246,0.9)',
          animation: '_nomad_pulse 1s ease-in-out infinite', flexShrink: 0,
        }} />
      )}
    </button>
  );
}

function LiveCodeView({ content, language, isWriting }: { content: string; language: string; isWriting: boolean }) {
  const [revealed, setRevealed] = useState(0);
  const prevContentRef = useRef('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // If content changed (new write), start/continue animation from where we are
    if (content !== prevContentRef.current) {
      prevContentRef.current = content;
      // If we're behind the content, catch up at typing speed
      if (revealed < content.length) {
        const tick = () => {
          setRevealed(prev => {
            const next = Math.min(prev + CHARS_PER_TICK, content.length);
            if (next < content.length) {
              timerRef.current = window.setTimeout(tick, TICK_MS);
            }
            return next;
          });
        };
        timerRef.current = window.setTimeout(tick, TICK_MS);
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [content, revealed]);

  // When writing finishes, fast-reveal remaining
  useEffect(() => {
    if (!isWriting && revealed < content.length) {
      // Quick flush — reveal rest in a few fast ticks
      const fastTick = () => {
        setRevealed(prev => {
          const next = Math.min(prev + 80, content.length);
          if (next < content.length) timerRef.current = window.setTimeout(fastTick, 8);
          return next;
        });
      };
      timerRef.current = window.setTimeout(fastTick, 8);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isWriting, content.length, revealed]);

  const visibleText = content.slice(0, revealed);
  const showCursor = isWriting || revealed < content.length;

  // Split into highlighted lines
  const highlighted = highlight(visibleText, language);
  const lines = highlighted.split('\n');

  return (
    <div style={{
      flex: 1, overflowY: 'auto', overflowX: 'auto',
      fontFamily: "'DM Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      fontSize: 11.5, lineHeight: '1.65',
      padding: '12px 0', position: 'relative',
    }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <tbody>
          {lines.map((lineHtml, i) => (
            <tr key={i} style={{ verticalAlign: 'top' }}>
              {/* Line number gutter */}
              <td style={{
                width: 38, minWidth: 38, textAlign: 'right', paddingRight: 14, paddingLeft: 8,
                color: 'rgba(255,255,255,0.18)', userSelect: 'none', fontSize: 10,
                borderRight: '1px solid rgba(255,255,255,0.06)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {i + 1}
              </td>
              {/* Code */}
              <td style={{ paddingLeft: 14, paddingRight: 12, wordBreak: 'break-all' }}>
                <span
                  dangerouslySetInnerHTML={{ __html: lineHtml }}
                  style={{ color: 'rgba(220,220,240,0.88)' }}
                />
                {/* Blue cursor at end of last line */}
                {showCursor && i === lines.length - 1 && (
                  <span
                    className="agent-cursor"
                    style={{
                      display: 'inline-block', width: 2, height: '1.2em',
                      background: 'rgba(59,130,246,0.95)',
                      verticalAlign: 'text-bottom', marginLeft: 1,
                      animation: 'agent-cursor-blink 0.9s ease-in-out infinite',
                      boxShadow: '0 0 6px rgba(59,130,246,0.6)',
                      borderRadius: 1,
                    }}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        @keyframes agent-cursor-blink {
          0%, 100% { opacity: 1; }
          45%, 55% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function FilePreviewPanel({ files, onClose, isDark = true }: FilePreviewPanelProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  // Auto-switch to the most recently writing file
  useEffect(() => {
    const writingIdx = files.findLastIndex(f => f.isWriting);
    if (writingIdx >= 0) setActiveIdx(writingIdx);
  }, [files]);

  const activeFile = files[activeIdx] ?? files[0];
  if (!activeFile) return null;

  const lang = activeFile.language || inferLanguage(activeFile.filename);
  const totalLines = activeFile.content.split('\n').length;
  const savedAgo = activeFile.savedAt
    ? Math.round((Date.now() - activeFile.savedAt) / 1000)
    : null;

  return (
    <div style={{
      width: 440, minWidth: 320, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(10,10,16,0.97)',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
      }}>
        {/* Status dot */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: activeFile.isWriting ? 'rgba(59,130,246,0.9)' : 'rgba(34,197,94,0.7)',
          boxShadow: activeFile.isWriting ? '0 0 6px rgba(59,130,246,0.5)' : 'none',
          animation: activeFile.isWriting ? '_nomad_pulse 1s ease-in-out infinite' : 'none',
        }} />

        {/* Tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', flex: 1, scrollbarWidth: 'none' }}>
          {files.map((f, i) => (
            <FileTab key={f.id} file={f} active={i === activeIdx} onClick={() => setActiveIdx(i)} />
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: 22, height: 22, borderRadius: 5, border: 'none',
            background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, lineHeight: 1,
          }}
          title="Close preview"
        >×</button>
      </div>

      {/* File path + meta bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.01)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', flex: 1, truncate: 'true', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeFile.filename}
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', flexShrink: 0, fontFamily: 'monospace' }}>
          {lang}
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
          {totalLines}L
        </span>
        {activeFile.isWriting ? (
          <span style={{ fontSize: 9, color: 'rgba(59,130,246,0.7)', flexShrink: 0, fontWeight: 600 }}>
            writing…
          </span>
        ) : savedAgo !== null && (
          <span style={{ fontSize: 9, color: 'rgba(34,197,94,0.6)', flexShrink: 0 }}>
            saved {savedAgo < 5 ? 'just now' : `${savedAgo}s ago`}
          </span>
        )}
      </div>

      {/* Code view */}
      <LiveCodeView
        content={activeFile.content}
        language={lang}
        isWriting={activeFile.isWriting}
      />

      {/* Footer */}
      <div style={{
        padding: '5px 14px', borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, background: 'rgba(255,255,255,0.01)',
      }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
          {activeFile.isWriting ? 'Agent is writing…' : `${activeFile.content.length} chars`}
        </span>
        <button
          onClick={() => {
            const blob = new Blob([activeFile.content], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = activeFile.filename.split('/').pop() || 'file.txt';
            a.click();
          }}
          style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
          }}
          title="Download file"
        >
          ↓ download
        </button>
      </div>
    </div>
  );
}
