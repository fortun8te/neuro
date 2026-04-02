import { useState, useCallback, useRef, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * ██ NEURO TERMINAL HOOK
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Manages terminal UI state and integrates with the campaign cycle loop.
 * Provides stuck detection, command handling, and log streaming.
 */

interface TerminalCommand {
  id: string;
  command: 'pause' | 'resume' | 'skip' | 'abort' | 'export' | 'settings';
  timestamp: number;
  executed: boolean;
}

interface LogMessage {
  id: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  timestamp: number;
  message: string;
  details?: string;
}

export function useNeuroTerminal() {
  const { systemStatus, currentCycle } = useCampaign();
  const [isTerminalMode, setIsTerminalMode] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [pendingCommands, setPendingCommands] = useState<TerminalCommand[]>([]);
  const logBufferRef = useRef<LogMessage[]>([]);

  // Add a log entry
  const addLog = useCallback(
    (level: 'info' | 'warn' | 'error' | 'success' | 'debug', message: string, details?: string) => {
      const entry: LogMessage = {
        id: `log-${Date.now()}-${Math.random()}`,
        level,
        timestamp: Date.now(),
        message,
        details,
      };
      logBufferRef.current.push(entry);
      setLogs((prev) => [...prev, entry]);

      // Keep only last 500 logs
      if (logs.length > 500) {
        setLogs((prev) => prev.slice(-500));
      }
    },
    [logs.length]
  );

  // Queue a command for the cycle loop to execute
  const queueCommand = useCallback(
    (command: 'pause' | 'resume' | 'skip' | 'abort' | 'export' | 'settings') => {
      const cmd: TerminalCommand = {
        id: `cmd-${Date.now()}`,
        command,
        timestamp: Date.now(),
        executed: false,
      };
      setPendingCommands((prev) => [...prev, cmd]);
      addLog('info', `Queued command: ${command}`);
    },
    [addLog]
  );

  // Check for stuck conditions
  const checkStuckConditions = useCallback(() => {
    if (!currentCycle) return;

    const currentStageData = currentCycle.stages[currentCycle.currentStage];
    if (!currentStageData?.startedAt) return;

    const elapsedMs = Date.now() - currentStageData.startedAt;
    const elapsedMinutes = elapsedMs / 1000 / 60;

    if (elapsedMinutes > 5) {
      addLog(
        'warn',
        `Stage "${currentCycle.currentStage}" stuck for ${Math.round(elapsedMinutes)}m`,
        `Consider: [Skip] [Pause] [Restart]. See stuck panel for options.`
      );
    }

    if (elapsedMinutes > 10) {
      addLog('error', `Critical: Stage running for ${Math.round(elapsedMinutes)}m`, 'Recommend immediate action');
    }
  }, [currentCycle, addLog]);

  // Periodic stuck check
  useEffect(() => {
    if (systemStatus !== 'running') return;
    const interval = setInterval(checkStuckConditions, 30000); // every 30s
    return () => clearInterval(interval);
  }, [systemStatus, checkStuckConditions]);

  // Toggle terminal mode
  const toggleTerminalMode = useCallback(() => {
    setIsTerminalMode((prev) => !prev);
  }, []);

  // Export logs as text
  const exportLogs = useCallback(() => {
    const text = logs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toISOString();
        return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.details ? '\n  ' + log.details : ''}`;
      })
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuro-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLog('success', 'Logs exported to file');
  }, [logs, addLog]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    logBufferRef.current = [];
  }, []);

  return {
    isTerminalMode,
    toggleTerminalMode,
    logs,
    addLog,
    clearLogs,
    exportLogs,
    pendingCommands,
    queueCommand,
    checkStuckConditions,
  };
}
