/**
 * AppShell — Minimal sidebar + chat layout (Neuro redesign)
 *
 * Left sidebar (~216px): NEURO branding, recent chats, user menu
 * Main content: AgentPanel (chat) or HomeScreen (empty state)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { SettingsModal } from './SettingsModal';
import { LoginScreen } from './LoginScreen';
import { AgentPanel } from './AgentPanel';
import { HomeScreen } from './HomeScreen';
import TasksPage from './TasksPage';
import { SettingsIcon, LogOutIcon, ChevronDown, SidebarIcon } from './Icons';
import BlobAvatar, { getAgentColor } from './BlobAvatar';
import { getUserAvatarSeed, getUserAvatarColor, getUserInitials } from './UserAvatar';
import { healthMonitor } from '../utils/healthMonitor';
import { ollamaService } from '../utils/ollama';
import { GlassFilter } from './LiquidGlass';
import { listConversationSummaries, deleteConversation, type ConversationSummary } from '../utils/chatHistory';
import { generateWorkspaceId } from '../utils/workspace';
import { FONT_FAMILY } from '../constants/ui';

// ── Per-chat color blob using consistent hash ──────────────────────────────
function getColorForChat(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }
  return getAgentColor(Math.abs(hash) % 8);
}

// ── Recent chat list item ──────────────────────────────────────────────────
function RecentChatItem({
  chat,
  isActive,
  isDarkMode,
  animationsEnabled,
  onClick,
  onDelete,
}: {
  chat: ConversationSummary;
  isActive: boolean;
  isDarkMode: boolean;
  animationsEnabled: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = getColorForChat(chat.id);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        background: isActive
          ? isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
          : hovered
            ? isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
            : 'transparent',
        transition: 'background 0.1s',
        position: 'relative',
      }}
    >
      {/* Colored blob circle */}
      <BlobAvatar
        seed={chat.id}
        color={color}
        size={20}
        animated={animationsEnabled}
      />
      <span style={{
        flex: 1,
        fontSize: 13,
        fontFamily: FONT_FAMILY,
        color: isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {chat.title || 'New conversation'}
      </span>
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
            fontSize: 14,
            lineHeight: 1,
            borderRadius: 4,
          }}
          title="Delete chat"
          aria-label="Delete chat"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Main AppShell ────────────────────────────────────────────────────────────
export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, animationsEnabled } = useTheme();
  const { user, loading: authLoading, logout, loginAsGuest } = useAuth();

  // Parse chatId from URL: /neuro/:chatId
  const urlChatId = (() => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts[0] === 'neuro' && parts[1] ? parts[1] : null;
  })();

  const [activeView, setActiveView] = useState<'chat' | 'tasks'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showHome, setShowHome] = useState(!urlChatId);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [chats, setChats] = useState<ConversationSummary[]>([]);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState(() => getUserAvatarSeed());
  const [avatarColor, setAvatarColor] = useState(() => getUserAvatarColor());
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const newChatLockRef = useRef(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Listen for avatar seed and color changes from Settings
  useEffect(() => {
    const seedHandler = (e: Event) => {
      const seed = (e as CustomEvent).detail;
      if (seed) setAvatarSeed(seed);
    };
    const colorHandler = (e: Event) => {
      const color = (e as CustomEvent).detail;
      if (color) setAvatarColor(color);
    };
    const taskDetectHandler = (e: Event) => {
      // When AgentPanel detects a task pattern, switch to tasks view
      setActiveView('tasks');
    };
    window.addEventListener('neuro-avatar-seed-changed', seedHandler);
    window.addEventListener('neuro-avatar-color-changed', colorHandler);
    window.addEventListener('neuro-detect-task', taskDetectHandler);
    return () => {
      window.removeEventListener('neuro-avatar-seed-changed', seedHandler);
      window.removeEventListener('neuro-avatar-color-changed', colorHandler);
      window.removeEventListener('neuro-detect-task', taskDetectHandler);
    };
  }, []);

  // Kick off health checks and task scheduler
  useEffect(() => {
    healthMonitor.start();
    ollamaService.startupCheck();

    // Start task scheduler with proper cleanup
    let stopScheduler: (() => void) | null = null;
    import('../utils/taskScheduler')
      .then(({ startScheduler: startSched, stopScheduler: stopSched }) => {
        stopScheduler = stopSched;
        return startSched().catch((e: Error) => {
          console.error('Failed to start task scheduler:', e);
          // Don't crash entire app, but log clearly
        });
      })
      .catch((e) => {
        console.error('Failed to load task scheduler module:', e);
        // Module load failure is non-fatal, app continues without scheduler
      });

    return () => {
      healthMonitor.stop();
      if (stopScheduler) {
        try {
          stopScheduler();
        } catch (e) {
          console.warn('Error stopping scheduler:', e);
        }
      }
    };
  }, []);

  // Do not auto-login as guest — let user see LoginScreen to choose Firebase or guest

  // Sync URL -> home state
  useEffect(() => {
    if (urlChatId) setShowHome(false);
    else if (location.pathname === '/neuro' || location.pathname === '/') setShowHome(true);
  }, [urlChatId, location.pathname]);

  // Redirect / -> /neuro
  useEffect(() => {
    if (location.pathname === '/') navigate('/neuro', { replace: true });
  }, [location.pathname, navigate]);

  // Load recent chats
  const refreshChats = useCallback(async () => {
    try {
      const summaries = await listConversationSummaries();
      setChats(summaries);
    } catch (error) { console.warn('Failed to load chats:', error); }
  }, []);

  useEffect(() => { refreshChats(); }, [refreshChats, urlChatId]);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNewChat = useCallback(async (message?: string) => {
    if (newChatLockRef.current || isCreatingChat) return;
    newChatLockRef.current = true;
    setIsCreatingChat(true);
    try {
      const newId = crypto.randomUUID();
      if (message) setInitialMessage(message);
      await navigate(`/neuro/${newId}`);
      setShowHome(false);
      await refreshChats();
    } finally {
      setIsCreatingChat(false);
      newChatLockRef.current = false;
    }
  }, [isCreatingChat, navigate, refreshChats]);

  const handleSelectChat = useCallback((id: string) => {
    navigate(`/neuro/${id}`);
    setShowHome(false);
  }, [navigate]);

  const handleDeleteChat = useCallback(async (id: string) => {
    try {
      await deleteConversation(id);
      await refreshChats();
      if (urlChatId === id) {
        navigate('/neuro');
        setShowHome(true);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  }, [urlChatId, navigate, refreshChats]);

  // Loading screen
  if (authLoading) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isDarkMode ? '#0a0a0a' : '#F4F4F1',
        fontFamily: FONT_FAMILY,
      }}>
        <div style={{ textAlign: 'center', color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontSize: 13 }}>
          Loading…
        </div>
      </div>
    );
  }

  const SIDEBAR_W = sidebarOpen ? 216 : 0;

  return (
    <div
      className="flex relative"
      style={{ height: '100dvh', overflow: 'hidden', background: isDarkMode ? '#0a0a0a' : '#F5F3EF' }}
    >
      <GlassFilter />

      {/* ── Sidebar ─────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: SIDEBAR_W, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            style={{
              flexShrink: 0,
              height: '100dvh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: isDarkMode ? '#111111' : '#ffffff',
              borderRight: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* Top bar - Sidebar header with blob avatar + NEURO + MAX badge (Figma 796:663) */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 10px 8px',
              flexShrink: 0,
              position: 'relative',
            }}>
              {/* Blob avatar + NEURO wordmark + MAX pill badge (Figma 796:663) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2, userSelect: 'none', flex: 1, minWidth: 0 }}>
                <BlobAvatar
                  seed={avatarSeed}
                  color={avatarColor}
                  size={28}
                  animated={animationsEnabled}
                />
                <span style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: isDarkMode ? '#ffffff' : '#0F0F0F',
                  fontFamily: FONT_FAMILY,
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                }}>
                  NEURO
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)',
                  fontFamily: FONT_FAMILY,
                  letterSpacing: '0.05em',
                  lineHeight: 1,
                  border: `1.5px solid ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(102,102,102,0.3)'}`,
                  borderRadius: 3,
                  padding: '3px 6px',
                }}>
                  MAX
                </span>
              </div>

{/* New chat button removed — single instance lives in the main toolbar */}
            </div>

            {/* Recents */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
              {chats.length > 0 && (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
                    padding: '8px 10px 4px',
                    fontFamily: FONT_FAMILY,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    Recents
                  </div>
                  {chats.map(chat => (
                    <RecentChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === urlChatId}
                      isDarkMode={isDarkMode}
                      animationsEnabled={animationsEnabled}
                      onClick={() => handleSelectChat(chat.id)}
                      onDelete={() => handleDeleteChat(chat.id)}
                    />
                  ))}
                </>
              )}
            </div>

            {/* User menu at bottom */}
            <div style={{
              flexShrink: 0,
              padding: '8px 10px',
              borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
              position: 'relative',
            }} ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  background: showUserMenu
                    ? isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
                    : 'none',
                  border: 'none', cursor: 'pointer', borderRadius: 8,
                  padding: '8px 8px',
                }}
                className={`nomad-menu-item ${!showUserMenu ? (isDarkMode ? 'nomad-menu-item-dark' : 'nomad-menu-item-light') : ''}`}
              >
                <BlobAvatar
                  seed={avatarSeed}
                  color={avatarColor}
                  size={26}
                  initials={getUserInitials(user?.name)}
                  animated={animationsEnabled}
                />
                <span style={{
                  flex: 1, textAlign: 'left',
                  fontSize: 13, fontWeight: 500,
                  color: isDarkMode ? 'rgba(255,255,255,0.8)' : '#0F0F0F',
                  fontFamily: FONT_FAMILY,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {user?.name || 'Guest'}
                </span>
                <ChevronDown size={12} color={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
              </button>

              {/* Dropdown */}
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: 'absolute', bottom: '100%', left: 8, right: 8, marginBottom: 4,
                      background: isDarkMode ? '#1a1a1a' : '#ffffff',
                      borderRadius: 12,
                      border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                      boxShadow: isDarkMode
                        ? '0 8px 32px rgba(0,0,0,0.6)'
                        : '0 8px 32px rgba(0,0,0,0.12)',
                      overflow: 'hidden',
                      zIndex: 100,
                    }}
                  >
                    {/* User info */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px',
                      borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                    }}>
                      <BlobAvatar
                        seed={avatarSeed}
                        color={avatarColor}
                        size={36}
                        initials={getUserInitials(user?.name)}
                        animated={animationsEnabled}
                      />
                      <div>
                        <div style={{
                          fontSize: 14, fontWeight: 700,
                          color: isDarkMode ? '#ffffff' : '#0F0F0F',
                          fontFamily: FONT_FAMILY,
                        }}>{user?.name || 'Guest'}</div>
                        <div style={{
                          fontSize: 11,
                          color: isDarkMode ? 'rgba(255,255,255,0.35)' : '#9CA3AF',
                          fontFamily: FONT_FAMILY,
                          maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{user?.id ? `${user.id.slice(0, 20)}…` : 'Guest'}</div>
                      </div>
                    </div>

                    {/* Settings */}
                    <button
                      onClick={() => { setShowUserMenu(false); setShowSettings(true); }}
                      className={`nomad-menu-item ${isDarkMode ? 'nomad-menu-item-dark' : 'nomad-menu-item-light'}`}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 16px', background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                        color: isDarkMode ? 'rgba(255,255,255,0.75)' : '#374151',
                        fontFamily: FONT_FAMILY,
                        fontSize: 14,
                      }}
                    >
                      <SettingsIcon size={15} />
                      Settings
                    </button>

                    {/* Divider */}
                    <div style={{ height: 1, background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', margin: '0 8px' }} />

                    {/* Log out */}
                    <button
                      onClick={async () => { setShowUserMenu(false); await logout(); }}
                      className="nomad-menu-item nomad-menu-item-danger"
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 16px', background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                        color: '#ef4444',
                        fontFamily: FONT_FAMILY,
                        fontSize: 14,
                      }}
                    >
                      <LogOutIcon size={15} />
                      Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Top bar */}
        <div style={{
          height: 44, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          background: 'transparent',
        }}>
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
            className={`nomad-icon-btn ${isDarkMode ? 'nomad-icon-btn-dark' : 'nomad-icon-btn-light'}`}
          >
            <SidebarIcon size={16} />
          </button>

          {/* New chat button (always visible for consistent layout) */}
          <button
            onClick={() => handleNewChat()}
            disabled={isCreatingChat}
            title="New chat"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 6, opacity: isCreatingChat ? 0.4 : 1,
              display: 'flex', alignItems: 'center',
            }}
            className={`nomad-icon-btn ${isDarkMode ? 'nomad-icon-btn-dark' : 'nomad-icon-btn-light'}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>

          {/* Chat / Tasks toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 2 }}>
            <button
              onClick={() => setActiveView('chat')}
              style={{
                fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 6,
                background: activeView === 'chat' ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') : 'transparent',
                color: activeView === 'chat' ? (isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)') : (isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'),
                border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                fontFamily: FONT_FAMILY,
              }}
            >Chat</button>
            <button
              onClick={() => setActiveView('tasks')}
              style={{
                fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 6,
                background: activeView === 'tasks' ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') : 'transparent',
                color: activeView === 'tasks' ? (isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)') : (isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'),
                border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                fontFamily: FONT_FAMILY,
              }}
            >Tasks</button>
          </div>

          <div style={{ flex: 1 }} />
        </div>

        {/* Page content — explicit flex-1 + minHeight:0 so children get a definite height */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!user && !authLoading ? (
            <LoginScreen onLogin={() => {}} onSignup={() => {}} />
          ) : activeView === 'tasks' ? (
            <TasksPage />
          ) : showHome ? (
            <HomeScreen
              onContinue={() => {
                if (chats.length > 0) { handleSelectChat(chats[0].id); }
                else { handleNewChat(); }
              }}
              onNewChat={handleNewChat}
            />
          ) : (
            <AgentPanel
              key={urlChatId || 'new'}
              initialChatId={urlChatId ?? undefined}
              initialMessage={initialMessage ?? undefined}
              hideSidebar={true}
              onInitialMessageSent={() => setInitialMessage(null)} // FIX: Clear initialMessage after auto-send
            />
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={user ?? undefined}
        onLogout={logout}
      />
    </div>
  );
}
