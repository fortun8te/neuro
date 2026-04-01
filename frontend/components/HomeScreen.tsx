/**
 * HomeScreen — Landing view shown at /neuro when no chat is active.
 * Shows a greeting and a live input bar that starts a new chat on submit.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { listConversationSummaries, deleteConversation, type ConversationSummary } from '../utils/chatHistory';
import BlobAvatar from './BlobAvatar';
import { getAgentColor } from './BlobAvatar';
import { FONT_FAMILY } from '../constants/ui';

interface HomeScreenProps {
  onContinue: () => void;
  onNewChat?: (initialMessage?: string) => void;
}

function getColorForChat(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }
  return getAgentColor(Math.abs(hash) % 8);
}

// SVG icon paths for quick menu items (12x12 viewBox="0 0 24 24")
const MENU_ICONS: Record<string, string> = {
  web_search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', // magnifying glass
  browse: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zM17.9 17.39c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z', // globe
  file_read: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z', // folder
  analyze_page: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', // eye
  memory_store: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', // book
  image_analyze: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', // image
  deep_research: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', // lightbulb
  write_content: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', // edit/pen
  write: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', // write/pen
  subagent: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', // users/agents
};

// All quick menu items: Tools + Subagents + Canvas
const ALL_MENU_ITEMS = [
  // Tools
  { category: 'Tools', id: 'web_search', label: 'Web Search', description: 'Search the web', insert: '@search' },
  { category: 'Tools', id: 'browse', label: 'Browse', description: 'Read a URL', insert: '@browse' },
  { category: 'Tools', id: 'canvas', label: 'Canvas', description: 'Open editor canvas', insert: '/canvas' },
  { category: 'Tools', id: 'file_read', label: 'Files', description: 'Read workspace files', insert: '@files' },
  { category: 'Tools', id: 'analyze_page', label: 'Analyze', description: 'Screenshot + analyze', insert: '@analyze' },
  { category: 'Tools', id: 'memory_store', label: 'Memory', description: 'Store and recall', insert: '@memory' },
  { category: 'Tools', id: 'image_analyze', label: 'Vision', description: 'Analyze images', insert: '@vision' },
  { category: 'Tools', id: 'deep_research', label: 'Research', description: 'Multi-query deep research', insert: '@research' },
  { category: 'Tools', id: 'write', label: 'Write', description: 'Generate content', insert: '@write' },
  // Subagents: single generic @sub trigger
  { category: 'Subagents', id: 'subagent', label: 'Subagent', description: 'Spawn or call a subagent', insert: '@sub' }
];

export function HomeScreen({ onContinue, onNewChat }: HomeScreenProps) {
  const { isDarkMode, animationsEnabled } = useTheme();
  const { user } = useAuth();

  const [recentChats, setRecentChats] = useState<ConversationSummary[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = menu hidden
  const [menuSelected, setMenuSelected] = useState(0);
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [activeMentions, setActiveMentions] = useState<typeof ALL_MENU_ITEMS>([]);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Filter items based on @ query
  const filteredItems = useMemo(() => {
    if (mentionQuery === null) return [];
    if (mentionQuery === '') return ALL_MENU_ITEMS; // show all when just "@"
    const q = mentionQuery.toLowerCase();
    return ALL_MENU_ITEMS.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.insert.toLowerCase().includes('@' + q) ||
      item.description.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  }, [mentionQuery]);

  const filteredTools = useMemo(() => filteredItems.filter(i => i.category === 'Tools'), [filteredItems]);
  const filteredSubs = useMemo(() => filteredItems.filter(i => i.category === 'Subagents'), [filteredItems]);
  const showMenu = mentionQuery !== null && filteredItems.length > 0;

  useEffect(() => {
    listConversationSummaries?.()
      .then(convs => setRecentChats(convs.slice(0, 4)))
      .catch(() => {});
  }, []);

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-quick-menu]')) {
        setMentionQuery(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Reset selection when filter changes
  useEffect(() => { setMenuSelected(0); }, [mentionQuery]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleSubmit = () => {
    const text = inputValue.trim();
    if (!text && activeMentions.length === 0) return;
    // Prepend active mentions to the message
    const mentionPrefix = activeMentions.map(m => m.insert).join(' ');
    const fullMessage = mentionPrefix && text ? `${mentionPrefix} ${text}` : (mentionPrefix || text);
    if (onNewChat) onNewChat(fullMessage);
    else onContinue();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Detect @ mention trigger: find the last @ in the text
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]); // everything after @
    } else {
      setMentionQuery(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Quick menu navigation
    if (showMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuSelected(i => (i + 1) % filteredItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuSelected(i => (i - 1 + filteredItems.length) % filteredItems.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredItems[menuSelected];
        if (selected) insertMention(selected);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const insertMention = (item: typeof ALL_MENU_ITEMS[0]) => {
    // Remove only the @query trigger, preserve any text after it
    const textBeforeAt = inputValue.substring(0, inputValue.lastIndexOf('@'));
    const newValue = textBeforeAt.trimEnd();
    setInputValue(newValue ? newValue + ' ' : '');
    setMentionQuery(null);
    // Track active mention (avoid duplicates)
    setActiveMentions(prev => prev.some(m => m.id === item.id) ? prev : [...prev, item]);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Speech recognition handler
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setInputValue(prev => (prev.trim() ? prev + ' ' + transcript : transcript).trim());
        } else {
          interimTranscript += transcript;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Shared compact row renderer
  const renderItem = (item: typeof ALL_MENU_ITEMS[0], globalIdx: number, color: string) => {
    const isSelected = globalIdx === menuSelected;
    return (
      <button
        key={item.id}
        onClick={() => insertMention(item)}
        onMouseEnter={() => setMenuSelected(globalIdx)}
        className="hover:scale-[1.01] active:scale-[0.99] transition-transform"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', border: 'none',
          background: isSelected ? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent',
          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
          fontFamily: FONT_FAMILY,
        }}
      >
        <div style={{
          width: 22, height: 22, flexShrink: 0, borderRadius: 6,
          background: `${color}18`,
          border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={MENU_ICONS[item.id] || ''} />
          </svg>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 500,
          color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
          whiteSpace: 'nowrap',
        }}>
          {item.label}
        </span>
        <span style={{
          fontSize: 11,
          color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.description}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace',
          color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
          flexShrink: 0,
        }}>
          {item.insert}
        </span>
        {(item.id === 'deep_research' || item.id === 'subagent') && (
          <span style={{ fontSize: 9, opacity: 0.3, fontFamily: 'monospace' }}>
            {item.id === 'deep_research' ? 'context-1' : 'nemotron'}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        position: 'relative',
        background: isDarkMode ? '#0a0a0a' : '#F5F3EF',
        padding: '48px 24px 32px',
      }}
    >
      {/* Subtle bg glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: isDarkMode
          ? 'radial-gradient(ellipse at 60% 90%, rgba(43,121,255,0.06) 0%, transparent 55%)'
          : 'radial-gradient(ellipse at 65% 85%, rgba(56,189,248,0.25) 0%, transparent 50%), radial-gradient(ellipse at 85% 60%, rgba(59,130,246,0.15) 0%, transparent 50%)',
        filter: 'blur(40px)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 660, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>

        {/* Agent Blob Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div>
            <BlobAvatar seed="neuro-agent" color="#3b82f6" size={60} animated={animationsEnabled} />
          </div>
          <h1 style={{
            fontFamily: FONT_FAMILY, fontSize: 32, fontWeight: 600, letterSpacing: '-0.01em',
            color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.88)',
            margin: 0, lineHeight: 1.2,
          }}>
            {`${greeting}, ${firstName}`}
          </h1>
        </div>

        {/* Input bar */}
        <div style={{ width: '100%', position: 'relative' }}>
          <div
            className="nomad-glass-medium"
            style={{ borderRadius: 15, width: '100%', boxShadow: '0px 4px 15px rgba(0,0,0,0.05)', position: 'relative' }}
            data-quick-menu
          >
            {/* @ Quick Menu Dropdown */}
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    maxHeight: 340,
                    overflowY: 'auto',
                    borderRadius: 12,
                    border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                    background: isDarkMode ? 'rgba(20,20,24,0.97)' : 'rgba(255,255,255,0.97)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    padding: '4px 0'
                  }}
                  data-quick-menu
                >
                  {/* Tools Section */}
                  {filteredTools.length > 0 && (
                    <div>
                      <div style={{
                        padding: '6px 12px 4px',
                        fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                        color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
                        textTransform: 'uppercase'
                      }}>
                        Tools
                      </div>
                      {filteredTools.map((item) => {
                        const globalIdx = filteredItems.indexOf(item);
                        return renderItem(item, globalIdx, '#3b82f6');
                      })}
                    </div>
                  )}

                  {/* Subagents Section */}
                  {filteredSubs.length > 0 && (
                    <div style={filteredTools.length > 0 ? { borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)', marginTop: 2 } : undefined}>
                      <div style={{
                        padding: '6px 12px 4px',
                        fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                        color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
                        textTransform: 'uppercase'
                      }}>
                        Subagents
                      </div>
                      {filteredSubs.map((item) => {
                        const globalIdx = filteredItems.indexOf(item);
                        return renderItem(item, globalIdx, '#a855f7');
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 14px' }}>
              {/* Active mention tags inline with input */}
              {activeMentions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  {activeMentions.map(m => {
                    const isAgent = m.category === 'Subagents';
                    const bgColor = isAgent ? 'rgba(168,85,247,0.2)' : 'rgba(59,130,246,0.18)';
                    const borderColor = isAgent ? 'rgba(168,85,247,0.35)' : 'rgba(59,130,246,0.3)';
                    const textColor = isAgent ? '#d8b4fe' : '#93c5fd';
                    const iconColor = isAgent ? '#d8b4fe' : '#60a5fa';
                    return (
                      <span
                        key={m.id}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '4px 8px 4px 6px', borderRadius: 5,
                          background: bgColor,
                          border: `1px solid ${borderColor}`,
                          fontSize: 10, fontWeight: 600, color: textColor,
                          fontFamily: FONT_FAMILY, userSelect: 'none',
                        }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d={MENU_ICONS[m.id] || ''} />
                        </svg>
                        <span style={{ fontSize: 9 }}>{m.insert}</span>
                        <button
                          onClick={() => setActiveMentions(prev => prev.filter(x => x.id !== m.id))}
                          className="nomad-close-btn"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: textColor, fontSize: 8, padding: '0 0 0 1px', lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything"
                rows={1}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  resize: 'none', fontSize: 13, lineHeight: '1.6',
                  fontFamily: FONT_FAMILY,
                  color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.82)',
                  minHeight: 24, maxHeight: 120,
                }}
                className={isDarkMode ? 'placeholder:text-white/[0.15]' : 'placeholder:text-black/25'}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                }}
              />
              {/* Microphone button */}
              <button
                onClick={() => isListening ? stopListening() : startListening()}
                title={isListening ? 'Stop listening' : 'Start voice input'}
                style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isListening
                    ? (isDarkMode ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)')
                    : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                  color: isListening
                    ? (isDarkMode ? '#ff6b6b' : '#ef4444')
                    : (isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'),
                  transition: 'all 0.15s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19v3M19 10v2a7 7 0 0 1-14 0v-2"/><rect width="6" height="13" x="9" y="2" rx="3"/>
                </svg>
              </button>

              {/* Send button (dark rounded square like Figma) */}
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim() && activeMentions.length === 0}
                style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                  border: 'none', cursor: inputValue.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: inputValue.trim()
                    ? (isDarkMode ? '#fff' : '#1a1a1a')
                    : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                  color: inputValue.trim()
                    ? (isDarkMode ? '#000' : '#fff')
                    : (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)'),
                  transition: 'all 0.15s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Recent chats */}
        {recentChats.length > 0 && (
          <div style={{ width: '100%' }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              color: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
              padding: '0 12px 4px',
              fontFamily: FONT_FAMILY,
              letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
            }}>
              Recents
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentChats.map(chat => (
                <div
                  key={chat.id}
                  onMouseEnter={() => setHoveredChatId(chat.id)}
                  onMouseLeave={() => setHoveredChatId(null)}
                  onClick={() => onContinue()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: hoveredChatId === chat.id
                      ? isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                      : 'transparent',
                    border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all 0.1s',
                    fontFamily: FONT_FAMILY,
                    position: 'relative',
                  }}
                >
                  <BlobAvatar seed={chat.id} color={getColorForChat(chat.id)} size={24} animated={true} />
                  <span style={{
                    flex: 1, fontSize: 13, fontWeight: 500,
                    color: isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {chat.title || 'New conversation'}
                  </span>
                  {hoveredChatId === chat.id && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await deleteConversation(chat.id);
                          setRecentChats(prev => prev.filter(c => c.id !== chat.id));
                        } catch (error) {
                          console.error('Failed to delete chat:', error);
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                        fontSize: 14,
                        lineHeight: 1,
                        borderRadius: 4,
                        transition: 'color 0.1s',
                      }}
                      className={`nomad-icon-btn ${isDarkMode ? 'nomad-icon-btn-dark' : 'nomad-icon-btn-light'}`}
                      title="Delete chat"
                      aria-label="Delete chat"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
