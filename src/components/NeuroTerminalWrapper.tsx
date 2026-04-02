import { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useTheme } from '../context/ThemeContext';
import { NeuroTerminalUI } from './NeuroTerminalUI';
import { Dashboard } from './Dashboard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * ██ NEURO TERMINAL WRAPPER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Smart container that:
 * - Shows full-screen NeuroTerminalUI during cycle execution
 * - Shows split view (terminal + dashboard) when paused
 * - Collapses to dashboard-only when idle
 * - Handles resize between panels
 */

interface NeuroTerminalWrapperProps {
  // Optional callbacks for actions
  onPause?: () => void;
  onResume?: () => void;
  onSkipStage?: () => void;
  onAbortCycle?: () => void;
  onExport?: () => void;
}

export function NeuroTerminalWrapper({
  onPause,
  onResume,
  onSkipStage,
  onAbortCycle,
  onExport,
}: NeuroTerminalWrapperProps) {
  const { systemStatus, currentCycle, campaign } = useCampaign();
  const { isDarkMode } = useTheme();
  const [splitViewEnabled, setSplitViewEnabled] = useState(true);
  const [terminalWidth, setTerminalWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);

  const isRunning = systemStatus === 'running';
  const cycleExists = !!currentCycle && !!campaign;

  // Auto-enable split view when running during a cycle
  useEffect(() => {
    if (isRunning && cycleExists) {
      setSplitViewEnabled(true);
    }
  }, [isRunning, cycleExists]);

  // Handle resize
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('neuro-split-container');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;

      // Constrain between 30% and 70%
      if (newWidth >= 30 && newWidth <= 70) {
        setTerminalWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handlers
  const handlePause = () => {
    onPause?.();
  };

  const handleResume = () => {
    onResume?.();
  };

  // ────────────────────────────────────────────────────────────────────────
  // CASE 1: Full Terminal (running cycle)
  // ────────────────────────────────────────────────────────────────────────
  if (isRunning && cycleExists && !splitViewEnabled) {
    return (
      <NeuroTerminalUI
        cycle={currentCycle}
        campaign={campaign}
        isRunning={true}
        onPause={handlePause}
        onResume={handleResume}
        onSkipStage={onSkipStage}
        onAbortCycle={onAbortCycle}
        onExport={onExport}
      />
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // CASE 2: Split View (running with split enabled)
  // ────────────────────────────────────────────────────────────────────────
  if (cycleExists && splitViewEnabled && isRunning) {
    return (
      <div
        id="neuro-split-container"
        className={`h-screen flex overflow-hidden ${isDarkMode ? 'bg-zinc-950' : 'bg-white'}`}
      >
        {/* Left: Terminal UI */}
        <div style={{ width: `${terminalWidth}%` }} className="overflow-hidden">
          <NeuroTerminalUI
            cycle={currentCycle}
            campaign={campaign}
            isRunning={isRunning}
            onPause={handlePause}
            onResume={handleResume}
            onSkipStage={onSkipStage}
            onAbortCycle={onAbortCycle}
            onExport={onExport}
          />
        </div>

        {/* Divider */}
        <div
          onMouseDown={() => setIsDragging(true)}
          className={`w-1 flex items-center justify-center cursor-col-resize transition-colors ${
            isDarkMode
              ? 'bg-white/[0.08] hover:bg-white/[0.12]'
              : 'bg-black/[0.08] hover:bg-black/[0.12]'
          }`}
        >
          <div
            className={`w-1 h-8 rounded-full transition-all ${
              isDarkMode ? 'bg-white/[0.3]' : 'bg-black/[0.3]'
            }`}
          />
        </div>

        {/* Right: Dashboard */}
        <div style={{ width: `${100 - terminalWidth}%` }} className="overflow-hidden">
          <Dashboard embedded={true} />
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setSplitViewEnabled(false)}
          className={`absolute top-6 right-6 p-2 rounded transition-all z-10 ${
            isDarkMode
              ? 'bg-white/[0.08] hover:bg-white/[0.12] text-white'
              : 'bg-black/[0.08] hover:bg-black/[0.12] text-black'
          }`}
          title="Expand terminal to full screen"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // CASE 3: Dashboard Only (idle or no cycle)
  // ────────────────────────────────────────────────────────────────────────
  return <Dashboard />;
}
