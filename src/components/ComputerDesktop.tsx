/**
 * ComputerDesktop — macOS-style desktop with dock and file icons
 *
 * Sits above the VNC browser window. Shows:
 * - Top menu bar (time, status)
 * - Dock at bottom with app icons
 * - Finder window (toggle via dock click)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconFinderReal, IconChromeReal, IconTerminalReal } from './RealMacOSIcons';
import { FinderWindow } from './FinderWindow';
import { ChromeWindow } from './ChromeWindow';
import { TerminalWindow } from './TerminalWindow';

export function ComputerDesktop() {
  const [time] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [isFinderOpen, setIsFinderOpen] = useState(false);
  const [isChromeOpen, setIsChromeOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col">
      {/* Top menu bar - macOS style */}
      <div className="h-6 px-4 flex items-center justify-between bg-black/[0.35] backdrop-blur-md border-b border-white/[0.05]">
        <div className="text-[10px] font-medium text-white/[0.50] tracking-wide">nomad</div>
        <div className="flex items-center gap-2">
          {/* AI MODE badge — signals this machine is AI-controlled */}
          <div
            aria-label="AI controlled machine"
            title="This desktop is operated by an AI agent"
            style={{
              background: 'rgba(43,121,255,0.15)',
              border: '1px solid rgba(43,121,255,0.25)',
              borderRadius: 4,
              padding: '1px 5px',
              fontSize: 8,
              fontWeight: 700,
              color: 'rgba(43,121,255,0.9)',
              letterSpacing: '0.06em',
              lineHeight: '14px',
            }}
          >
            AI
          </div>
          <div className="text-[10px] font-medium text-white/[0.40]">{time}</div>
        </div>
      </div>

      {/* Desktop area — windows render here, pointer-events-auto so windows are draggable */}
      <div className="flex-1 relative pointer-events-auto">
        <AnimatePresence>
          {isFinderOpen && (
            <FinderWindow onClose={() => setIsFinderOpen(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isChromeOpen && (
            <ChromeWindow onClose={() => setIsChromeOpen(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isTerminalOpen && (
            <TerminalWindow onClose={() => setIsTerminalOpen(false)} />
          )}
        </AnimatePresence>
      </div>

      {/* Bottom dock with liquid glass styling */}
      <div className="h-20 px-6 flex items-end justify-center pb-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-2 py-2 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(15,15,20,0.3) 0%, rgba(20,20,30,0.2) 100%)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          {/* Finder - toggles FinderWindow */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <motion.button
                whileHover={{ y: -8 }}
                whileTap={{ scale: 0.92, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => setIsFinderOpen(prev => !prev)}
                className="cursor-pointer pointer-events-auto"
                style={{ background: 'none', border: 'none', padding: 0, display: 'block' }}
                title="Open Finder — Browse session files"
                aria-label="Open Finder — Browse session files"
                data-ai-hint="Click to open the Finder file browser window"
              >
                <IconFinderReal size={62} />
              </motion.button>
              {isFinderOpen && (
                <div style={{
                  position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.7)',
                }} />
              )}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 1, letterSpacing: 0.2 }}>
              Finder
            </div>
          </div>

          {/* Chrome Browser */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <motion.button
                whileHover={{ y: -8 }}
                whileTap={{ scale: 0.92, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => setIsChromeOpen(prev => !prev)}
                className="cursor-pointer pointer-events-auto"
                style={{ background: 'none', border: 'none', padding: 0, display: 'block' }}
                title="Open Chrome — AI web browser"
                aria-label="Open Chrome — AI web browser"
                data-ai-hint="Click to open the Chrome browser for web navigation"
              >
                <IconChromeReal size={62} />
              </motion.button>
              {isChromeOpen && (
                <div style={{
                  position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.7)',
                }} />
              )}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 1, letterSpacing: 0.2 }}>
              Chrome
            </div>
          </div>

          {/* Terminal */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <motion.button
                whileHover={{ y: -8 }}
                whileTap={{ scale: 0.92, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => setIsTerminalOpen(prev => !prev)}
                className="cursor-pointer pointer-events-auto"
                style={{ background: 'none', border: 'none', padding: 0, display: 'block' }}
                title="Terminal — AI command interface"
                aria-label="Terminal — AI command interface"
                data-ai-hint="Click to open the AI terminal command window"
              >
                <IconTerminalReal size={62} />
              </motion.button>
              {isTerminalOpen && (
                <div style={{
                  position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.7)',
                }} />
              )}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 1, letterSpacing: 0.2 }}>
              Terminal
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
