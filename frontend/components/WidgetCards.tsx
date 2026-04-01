import React from 'react';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const FONT_FAMILY = "'ABC Diatype Plus', system-ui, sans-serif";
const MAX_WIDTH = 400;
const BORDER_RADIUS = 16;

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------

function cardBase(isDark: boolean, hasGradient: boolean): React.CSSProperties {
  return {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS,
    maxWidth: MAX_WIDTH,
    width: '100%',
    fontFamily: FONT_FAMILY,
    color: hasGradient ? '#fff' : isDark ? '#e4e4e7' : '#27272a',
    background: hasGradient
      ? 'transparent'
      : isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(0,0,0,0.03)',
    border: hasGradient
      ? 'none'
      : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
    backdropFilter: hasGradient ? undefined : 'blur(12px)',
  };
}

function contentLayer(): React.CSSProperties {
  return { position: 'relative', zIndex: 1, padding: '20px 22px' };
}

function labelStyle(size: number = 11): React.CSSProperties {
  return {
    fontSize: size,
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    opacity: 0.7,
  };
}

// ---------------------------------------------------------------------------
// 1. WeatherWidget
// ---------------------------------------------------------------------------

interface WeatherWidgetProps {
  location: string;
  temp: number;
  condition: string;
  high: number;
  low: number;
  humidity: number;
  isDarkMode?: boolean;
}

export function WeatherWidget({
  location,
  temp,
  condition,
  high,
  low,
  humidity,
  isDarkMode = true,
}: WeatherWidgetProps) {
  return (
    <div style={cardBase(isDarkMode, true)}>
      {/* gradient bg */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: BORDER_RADIUS }}
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="weather-g1" cx="25%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.35" />
          </radialGradient>
          <radialGradient id="weather-g2" cx="80%" cy="75%" r="55%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.6" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="weather-g3" cx="60%" cy="20%" r="40%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={isDarkMode ? '#1c1917' : '#fff7ed'} rx="16" />
        <rect width="100%" height="100%" fill="url(#weather-g1)" rx="16" />
        <rect width="100%" height="100%" fill="url(#weather-g2)" rx="16" />
        <rect width="100%" height="100%" fill="url(#weather-g3)" rx="16" />
      </svg>

      <div style={contentLayer()}>
        <div style={{ ...labelStyle(), marginBottom: 2 }}>WEATHER</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.9 }}>{location}</div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 52, fontWeight: 700, lineHeight: 1 }}>{temp}&deg;</span>
          <span style={{ fontSize: 16, fontWeight: 500, opacity: 0.85 }}>{condition}</span>
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: 13, opacity: 0.8, marginTop: 8 }}>
          <span>H: {high}&deg;</span>
          <span>L: {low}&deg;</span>
          <span>Humidity: {humidity}%</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. CalendarWidget
// ---------------------------------------------------------------------------

interface CalendarEvent {
  title: string;
  time: string;
  date: string;
  duration?: string;
}

interface CalendarWidgetProps {
  events: CalendarEvent[];
  isDarkMode?: boolean;
}

export function CalendarWidget({ events, isDarkMode = true }: CalendarWidgetProps) {
  // Group by date
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!grouped[ev.date]) grouped[ev.date] = [];
    grouped[ev.date].push(ev);
  }

  return (
    <div style={cardBase(isDarkMode, true)}>
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: BORDER_RADIUS }}
        viewBox="0 0 400 240"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="calendar-g1" cx="20%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.3" />
          </radialGradient>
          <radialGradient id="calendar-g2" cx="85%" cy="80%" r="55%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.55" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={isDarkMode ? '#1a1625' : '#faf5ff'} rx="16" />
        <rect width="100%" height="100%" fill="url(#calendar-g1)" rx="16" />
        <rect width="100%" height="100%" fill="url(#calendar-g2)" rx="16" />
      </svg>

      <div style={contentLayer()}>
        <div style={{ ...labelStyle(), marginBottom: 14 }}>CALENDAR</div>

        {Object.entries(grouped).map(([date, evts]) => (
          <div key={date} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 6 }}>{date}</div>
            {evts.map((ev, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 10px',
                  marginBottom: 4,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.1)',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 52 }}>{ev.time}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{ev.title}</span>
                {ev.duration && (
                  <span style={{ fontSize: 11, opacity: 0.6 }}>{ev.duration}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. ChartWidget
// ---------------------------------------------------------------------------

interface ChartDataPoint {
  label: string;
  value: number;
}

interface ChartWidgetProps {
  title: string;
  data: ChartDataPoint[];
  type?: 'bar' | 'line';
  isDarkMode?: boolean;
}

export function ChartWidget({ title, data, type = 'bar', isDarkMode = true }: ChartWidgetProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartW = 340;
  const chartH = 100;
  const barGap = 6;
  const barW = data.length > 0 ? (chartW - barGap * (data.length - 1)) / data.length : 10;

  function buildLinePath(): string {
    if (data.length === 0) return '';
    const stepX = chartW / Math.max(data.length - 1, 1);
    return data
      .map((d, i) => {
        const x = i * stepX;
        const y = chartH - (d.value / maxVal) * chartH;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  }

  return (
    <div style={cardBase(isDarkMode, true)}>
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: BORDER_RADIUS }}
        viewBox="0 0 400 220"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="chart-g1" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.3" />
          </radialGradient>
          <radialGradient id="chart-g2" cx="75%" cy="80%" r="55%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={isDarkMode ? '#0f172a' : '#eff6ff'} rx="16" />
        <rect width="100%" height="100%" fill="url(#chart-g1)" rx="16" />
        <rect width="100%" height="100%" fill="url(#chart-g2)" rx="16" />
      </svg>

      <div style={contentLayer()}>
        <div style={{ ...labelStyle(), marginBottom: 4 }}>CHART</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{title}</div>

        <svg width={chartW} height={chartH + 24} viewBox={`0 0 ${chartW} ${chartH + 24}`}>
          {type === 'bar'
            ? data.map((d, i) => {
                const h = (d.value / maxVal) * chartH;
                const x = i * (barW + barGap);
                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={chartH - h}
                      width={barW}
                      height={h}
                      rx={4}
                      fill="rgba(255,255,255,0.75)"
                    />
                    <text
                      x={x + barW / 2}
                      y={chartH + 14}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.6)"
                      fontSize="9"
                      fontFamily={FONT_FAMILY}
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })
            : (
              <>
                <path d={buildLinePath()} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {data.map((d, i) => {
                  const stepX = chartW / Math.max(data.length - 1, 1);
                  const x = i * stepX;
                  const y = chartH - (d.value / maxVal) * chartH;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r={3.5} fill="#fff" />
                      <text
                        x={x}
                        y={chartH + 14}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.6)"
                        fontSize="9"
                        fontFamily={FONT_FAMILY}
                      >
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </>
            )}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. TaskListWidget
// ---------------------------------------------------------------------------

interface Task {
  text: string;
  done: boolean;
}

interface TaskListWidgetProps {
  title: string;
  tasks: Task[];
  isDarkMode?: boolean;
}

export function TaskListWidget({ title, tasks, isDarkMode = true }: TaskListWidgetProps) {
  const doneCount = tasks.filter((t) => t.done).length;
  const pct = tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0;

  return (
    <div style={cardBase(isDarkMode, true)}>
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: BORDER_RADIUS }}
        viewBox="0 0 400 240"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="task-g1" cx="25%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
          </radialGradient>
          <radialGradient id="task-g2" cx="80%" cy="75%" r="55%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={isDarkMode ? '#0a1a14' : '#ecfdf5'} rx="16" />
        <rect width="100%" height="100%" fill="url(#task-g1)" rx="16" />
        <rect width="100%" height="100%" fill="url(#task-g2)" rx="16" />
      </svg>

      <div style={contentLayer()}>
        <div style={{ ...labelStyle(), marginBottom: 4 }}>TASKS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{doneCount} of {tasks.length}</span>
        </div>

        {/* progress bar */}
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', marginBottom: 14 }}>
          <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: 'rgba(255,255,255,0.8)', transition: 'width 0.3s' }} />
        </div>

        {tasks.map((t, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '5px 0',
              opacity: t.done ? 0.55 : 1,
            }}
          >
            {/* checkbox */}
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                border: '2px solid rgba(255,255,255,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: t.done ? 'rgba(255,255,255,0.25)' : 'transparent',
              }}
            >
              {t.done && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span
              style={{
                fontSize: 13,
                textDecoration: t.done ? 'line-through' : 'none',
              }}
            >
              {t.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. TableWidget
// ---------------------------------------------------------------------------

interface TableWidgetProps {
  title: string;
  headers: string[];
  rows: string[][];
  isDarkMode?: boolean;
}

export function TableWidget({ title, headers, rows, isDarkMode = true }: TableWidgetProps) {
  const bg = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
  const altBg = isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)';
  const headerBg = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <div style={cardBase(isDarkMode, false)}>
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{ ...labelStyle(), marginBottom: 4 }}>TABLE</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      </div>

      <div style={{ overflowX: 'auto', padding: '0 12px 16px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: 13,
            borderRadius: 10,
            overflow: 'hidden',
            border: `1px solid ${borderColor}`,
          }}
        >
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    fontSize: 12,
                    background: headerBg,
                    borderBottom: `1px solid ${borderColor}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: '7px 12px',
                      background: ri % 2 === 0 ? bg : altBg,
                      borderBottom: ri < rows.length - 1 ? `1px solid ${borderColor}` : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. LinkCardWidget
// ---------------------------------------------------------------------------

interface LinkCardWidgetProps {
  title: string;
  description: string;
  url: string;
  favicon?: string;
  isDarkMode?: boolean;
}

export function LinkCardWidget({ title, description, url, favicon, isDarkMode = true }: LinkCardWidgetProps) {
  let displayUrl = url;
  try {
    displayUrl = new URL(url).hostname;
  } catch {
    /* keep raw string */
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        ...cardBase(isDarkMode, false),
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* favicon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {favicon ? (
          <img src={favicon} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6.5 3.5L11 8L6.5 12.5"
              stroke={isDarkMode ? '#a1a1aa' : '#71717a'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: isDarkMode ? '#e4e4e7' : '#27272a',
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: isDarkMode ? '#a1a1aa' : '#71717a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {description}
        </div>
        <div style={{ fontSize: 11, color: isDarkMode ? '#71717a' : '#a1a1aa', marginTop: 2 }}>
          {displayUrl}
        </div>
      </div>
    </a>
  );
}

// ---------------------------------------------------------------------------
// WidgetRenderer
// ---------------------------------------------------------------------------

export interface WidgetRendererProps {
  type: string;
  data: Record<string, unknown>;
  isDarkMode: boolean;
}

export function WidgetRenderer({ type, data, isDarkMode }: WidgetRendererProps) {
  switch (type) {
    case 'weather':
      return <WeatherWidget {...(data as unknown as WeatherWidgetProps)} isDarkMode={isDarkMode} />;
    case 'calendar':
      return <CalendarWidget {...(data as unknown as CalendarWidgetProps)} isDarkMode={isDarkMode} />;
    case 'chart':
      return <ChartWidget {...(data as unknown as ChartWidgetProps)} isDarkMode={isDarkMode} />;
    case 'tasks':
      return <TaskListWidget {...(data as unknown as TaskListWidgetProps)} isDarkMode={isDarkMode} />;
    case 'table':
      return <TableWidget {...(data as unknown as TableWidgetProps)} isDarkMode={isDarkMode} />;
    case 'link':
      return <LinkCardWidget {...(data as unknown as LinkCardWidgetProps)} isDarkMode={isDarkMode} />;
    default:
      return null;
  }
}
