/**
 * TaskHistoryPanel — Shows recent task execution history with grades
 */
import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';
import { getAllTaskLogs, getTaskStats, type TaskLog } from '../utils/taskStore';

// Grade colors
const gradeColor = (g: string) => ({
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444'
}[g] ?? '#94a3b8');

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function TaskHistoryPanel({ isOpen, onClose }: Props) {
  const { isDarkMode } = useTheme();
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getTaskStats>> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    getAllTaskLogs(30).then(setLogs);
    getTaskStats().then(setStats);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
      background: isDarkMode ? 'rgba(12,12,18,0.97)' : 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(20px)',
      borderLeft: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      zIndex: 200,
      display: 'flex', flexDirection: 'column',
      fontFamily: FONT_FAMILY,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: isDarkMode ? 'rgba(255,255,255,0.9)' : '#111' }}>Task History</div>
          {stats && <div style={{ fontSize: 11, color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#666', marginTop: 2 }}>
            {stats.completed} done &middot; {stats.failed} failed &middot; avg {(stats.avgDurationMs / 1000).toFixed(0)}s
          </div>}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#666' }}>x</button>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {logs.length === 0 && (
          <div style={{ textAlign: 'center', color: isDarkMode ? 'rgba(255,255,255,0.3)' : '#aaa', fontSize: 12, marginTop: 40 }}>
            No tasks yet
          </div>
        )}
        {logs.map(log => (
          <div key={log.id}
            onClick={() => setExpanded(expanded === log.id ? null : log.id)}
            style={{
              marginBottom: 8, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              transition: 'background 0.1s',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Status dot */}
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: log.status === 'completed' ? '#22c55e' : log.status === 'failed' ? '#ef4444' : log.status === 'running' ? '#eab308' : '#94a3b8'
              }} />
              <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: isDarkMode ? 'rgba(255,255,255,0.8)' : '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.name}
              </div>
              {log.reflection?.overallGrade && (
                <span style={{ fontSize: 11, fontWeight: 700, color: gradeColor(log.reflection.overallGrade) }}>
                  {log.reflection.overallGrade}
                </span>
              )}
              {log.durationMs && (
                <span style={{ fontSize: 10, color: isDarkMode ? 'rgba(255,255,255,0.3)' : '#aaa', flexShrink: 0 }}>
                  {(log.durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            {/* Expanded reflection */}
            {expanded === log.id && log.reflection && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <div style={{ fontSize: 11, color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#555', lineHeight: 1.5 }}>
                  {log.reflection.summary}
                </div>
                {log.reflection.improvements.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: isDarkMode ? 'rgba(255,255,255,0.3)' : '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Next time</div>
                    {log.reflection.improvements.map((imp, i) => (
                      <div key={i} style={{ fontSize: 11, color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#555', paddingLeft: 12 }}>&bull; {imp}</div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  {([['Goal', log.reflection.goalAchieved], ['Tools', log.reflection.toolEfficiency], ['Research', log.reflection.researchQuality]] as [string, number][]).map(([label, score]) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: score >= 7 ? '#22c55e' : score >= 5 ? '#eab308' : '#ef4444' }}>{score}</div>
                      <div style={{ fontSize: 9, color: isDarkMode ? 'rgba(255,255,255,0.3)' : '#aaa', textTransform: 'uppercase' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
