/**
 * NotesWindow -- scratchpad / notes app for AI agent working memory.
 *
 * - macOS-style window with traffic lights, draggable title bar
 * - Left sidebar: list of notes (title + date)
 * - Main area: plain textarea (monospace 12px)
 * - Markdown rendering toggle (edit vs rendered view)
 * - Auto-saves to IndexedDB via idb-keyval
 * - Agent API via desktopBus: note_write, note_read, note_content
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWindowDrag } from '../hooks/useWindowDrag';
import { desktopBus } from '../utils/desktopBus';
import { get, set } from 'idb-keyval';

// -- Types -------------------------------------------------------------------

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// -- IndexedDB persistence ---------------------------------------------------

const NOTES_KEY = 'desktop_notes';

async function loadNotes(): Promise<Note[]> {
  const raw = await get(NOTES_KEY);
  if (Array.isArray(raw)) return raw as Note[];
  return [];
}

async function saveNotes(notes: Note[]): Promise<void> {
  await set(NOTES_KEY, notes);
}

// -- Simple markdown renderer ------------------------------------------------

function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:12px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;font-weight:700;margin:12px 0 4px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:17px;font-weight:700;margin:14px 0 6px">$1</h1>')
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:3px;font-size:11px">$1</code>')
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:8px 0">')
    // Line breaks
    .replace(/\n/g, '<br>');
  return html;
}

// -- Traffic Lights ----------------------------------------------------------

function TrafficLights({ onClose }: { onClose: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="flex items-center gap-[6px]" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button onClick={onClose} className="w-3 h-3 rounded-full flex items-center justify-center" style={{ background: '#FF5F57', border: '0.5px solid rgba(0,0,0,0.25)', cursor: 'pointer' }}>
        {hovered && <svg width="6" height="6" viewBox="0 0 10 10" fill="none"><line x1="2" y1="2" x2="8" y2="8" stroke="#7a1a16" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="2" x2="2" y2="8" stroke="#7a1a16" strokeWidth="1.5" strokeLinecap="round" /></svg>}
      </button>
      <button className="w-3 h-3 rounded-full flex items-center justify-center" style={{ background: '#FEBC2E', border: '0.5px solid rgba(0,0,0,0.25)', cursor: 'pointer' }}>
        {hovered && <svg width="6" height="6" viewBox="0 0 10 10" fill="none"><line x1="2" y1="5" x2="8" y2="5" stroke="#7a5200" strokeWidth="1.5" strokeLinecap="round" /></svg>}
      </button>
      <button className="w-3 h-3 rounded-full flex items-center justify-center" style={{ background: '#28C840', border: '0.5px solid rgba(0,0,0,0.25)', cursor: 'pointer' }}>
        {hovered && <svg width="6" height="6" viewBox="0 0 10 10" fill="none"><line x1="2" y1="2" x2="8" y2="8" stroke="#0c4a1c" strokeWidth="1.3" strokeLinecap="round" /><line x1="8" y1="2" x2="2" y2="8" stroke="#0c4a1c" strokeWidth="1.3" strokeLinecap="round" /></svg>}
      </button>
    </div>
  );
}

// -- Component ---------------------------------------------------------------

export function NotesWindow({
  onClose,
  zIndex,
  onFocus,
}: {
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMarkdownView, setIsMarkdownView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    windowRef,
    pos,
    isDragging,
    onTitleBarMouseDown,
  } = useWindowDrag({ windowWidth: 500, windowHeight: 600, centerOffset: { x: -60, y: -20 } });

  const activeNote = useMemo(() => notes.find(n => n.id === activeId) ?? null, [notes, activeId]);

  // Load notes from IndexedDB on mount
  useEffect(() => {
    loadNotes().then(loaded => {
      setNotes(loaded);
      if (loaded.length > 0) setActiveId(loaded[0].id);
      setLoaded(true);
    });
  }, []);

  // Auto-save debounced
  const persistNotes = useCallback((updated: Note[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNotes(updated);
    }, 400);
  }, []);

  // Create a new note
  const createNote = useCallback(() => {
    const note: Note = {
      id: Math.random().toString(36).slice(2, 10),
      title: 'Untitled',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNotes(prev => {
      const next = [note, ...prev];
      persistNotes(next);
      return next;
    });
    setActiveId(note.id);
    setIsMarkdownView(false);
  }, [persistNotes]);

  // Update active note content
  const updateContent = useCallback((content: string) => {
    setNotes(prev => {
      const next = prev.map(n => n.id === activeId ? { ...n, content, updatedAt: Date.now() } : n);
      persistNotes(next);
      return next;
    });
  }, [activeId, persistNotes]);

  // Update active note title
  const updateTitle = useCallback((title: string) => {
    setNotes(prev => {
      const next = prev.map(n => n.id === activeId ? { ...n, title, updatedAt: Date.now() } : n);
      persistNotes(next);
      return next;
    });
  }, [activeId, persistNotes]);

  // Delete active note
  const deleteNote = useCallback(() => {
    if (!activeId) return;
    setNotes(prev => {
      const next = prev.filter(n => n.id !== activeId);
      persistNotes(next);
      return next;
    });
    setActiveId(prev => {
      const remaining = notes.filter(n => n.id !== prev);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  }, [activeId, notes, persistNotes]);

  // Desktop bus: note_write, note_read
  useEffect(() => {
    const unsub = desktopBus.subscribe(event => {
      if (event.type === 'note_write') {
        setNotes(prev => {
          const existing = prev.find(n => n.title === event.title);
          let next: Note[];
          if (existing) {
            next = prev.map(n => n.title === event.title ? { ...n, content: event.content, updatedAt: Date.now() } : n);
          } else {
            const note: Note = {
              id: Math.random().toString(36).slice(2, 10),
              title: event.title,
              content: event.content,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            next = [note, ...prev];
            setActiveId(note.id);
          }
          persistNotes(next);
          return next;
        });
      } else if (event.type === 'note_read') {
        const found = notes.find(n => n.title === event.title);
        desktopBus.emit({ type: 'note_content', title: event.title, content: found?.content ?? null });
      }
    });
    return unsub;
  }, [notes, persistNotes]);

  // Format date for sidebar
  const formatDate = (ts: number): string => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (!loaded) return null;

  return (
    <motion.div
      ref={windowRef}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseDownCapture={onFocus}
      style={{
        position: 'absolute',
        ...(pos !== null
          ? { left: pos.x, top: pos.y, transform: 'none' }
          : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        ),
        width: 500,
        height: 600,
        maxWidth: 500,
        maxHeight: 600,
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: zIndex ?? 200,
        pointerEvents: 'auto',
        background: '#121216',
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Title bar */}
      <div
        onMouseDown={onTitleBarMouseDown}
        style={{
          height: 36, display: 'flex', alignItems: 'center', paddingLeft: 14, paddingRight: 14,
          background: '#1c1c1e', borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0, cursor: isDragging ? 'grabbing' : 'grab', position: 'relative',
        }}
      >
        <TrafficLights onClose={onClose} />
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>
          Notes
        </div>
        {/* New note + delete buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={createNote}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 16, lineHeight: 1, padding: '0 4px' }}
            title="New note"
          >
            +
          </button>
          {activeNote && (
            <button
              onClick={deleteNote}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 1, padding: '0 4px' }}
              title="Delete note"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Body: sidebar + editor */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar: note list */}
        <div style={{
          width: 160, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.04)',
          overflowY: 'auto', background: 'rgba(255,255,255,0.015)',
        }}>
          {notes.length === 0 ? (
            <div style={{ padding: 12, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
              No notes yet
            </div>
          ) : notes.map(note => (
            <div
              key={note.id}
              onClick={() => { setActiveId(note.id); setIsMarkdownView(false); }}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                background: note.id === activeId ? 'rgba(59,130,246,0.15)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}
            >
              <div style={{
                fontSize: 11, fontWeight: 600,
                color: note.id === activeId ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {note.title}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                {formatDate(note.updatedAt)}
              </div>
            </div>
          ))}
        </div>

        {/* Main editor area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {activeNote ? (
            <>
              {/* Title input + markdown toggle */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 6 }}>
                <input
                  value={activeNote.title}
                  onChange={e => updateTitle(e.target.value)}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600,
                    fontFamily: 'system-ui,-apple-system,sans-serif',
                  }}
                />
                <button
                  onClick={() => setIsMarkdownView(v => !v)}
                  style={{
                    background: isMarkdownView ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid ' + (isMarkdownView ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'),
                    borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
                    color: isMarkdownView ? 'rgba(59,130,246,0.9)' : 'rgba(255,255,255,0.35)',
                    fontSize: 9, fontWeight: 600,
                  }}
                >
                  {isMarkdownView ? 'Edit' : 'Preview'}
                </button>
              </div>

              {/* Content area */}
              {isMarkdownView ? (
                <div
                  style={{
                    flex: 1, padding: 12, overflowY: 'auto',
                    fontSize: 12, lineHeight: 1.6,
                    color: 'rgba(255,255,255,0.7)',
                    fontFamily: 'system-ui,-apple-system,sans-serif',
                    userSelect: 'text',
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(activeNote.content) }}
                />
              ) : (
                <textarea
                  value={activeNote.content}
                  onChange={e => updateContent(e.target.value)}
                  placeholder="Start writing..."
                  style={{
                    flex: 1, resize: 'none', padding: 12,
                    background: 'transparent', border: 'none', outline: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    fontFamily: '"SF Mono",Monaco,Menlo,monospace',
                    fontSize: 12, lineHeight: 1.6,
                    userSelect: 'text',
                  }}
                />
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.15 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                  Click + to create a note
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
