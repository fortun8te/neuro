import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

/* ────────────────────────────────────────────────────────
   Shared helpers
   ──────────────────────────────────────────────────────── */

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

const glass = (dark: boolean) => ({
  background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
  border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
  borderRadius: 12,
});

export function cleanDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const brands: Record<string, string> = {
      'techcrunch.com': 'TechCrunch', 'reuters.com': 'Reuters',
      'bloomberg.com': 'Bloomberg', 'ft.com': 'Financial Times',
      'nytimes.com': 'NY Times', 'wsj.com': 'WSJ',
      'theverge.com': 'The Verge', 'wired.com': 'Wired',
      'arstechnica.com': 'Ars Technica', 'bbc.com': 'BBC',
      'bbc.co.uk': 'BBC', 'cnn.com': 'CNN', 'forbes.com': 'Forbes',
      'github.com': 'GitHub', 'stackoverflow.com': 'Stack Overflow',
      'medium.com': 'Medium', 'reddit.com': 'Reddit',
      'wikipedia.org': 'Wikipedia', 'arxiv.org': 'arXiv',
      'crunchbase.com': 'Crunchbase', 'pitchbook.com': 'PitchBook',
      'statista.com': 'Statista', 'mckinsey.com': 'McKinsey',
      'theguardian.com': 'The Guardian', 'apnews.com': 'AP News',
      'nature.com': 'Nature', 'sciencedirect.com': 'ScienceDirect',
      'google.com': 'Google', 'youtube.com': 'YouTube',
      'linkedin.com': 'LinkedIn', 'twitter.com': 'Twitter',
      'x.com': 'X', 'instagram.com': 'Instagram',
      'washingtonpost.com': 'Washington Post',
      'economist.com': 'The Economist', 'bain.com': 'Bain',
      'deloitte.com': 'Deloitte', 'pwc.com': 'PwC',
      'accenture.com': 'Accenture', 'gartner.com': 'Gartner',
    };
    return brands[host] || host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
  } catch {
    return url.slice(0, 30);
  }
}

function faviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

/* ────────────────────────────────────────────────────────
   SourceChips
   ──────────────────────────────────────────────────────── */

export interface SourceChipsProps {
  sources: Array<{ index: number; title: string; url: string; snippet?: string }>;
}

export function SourceChips({ sources }: SourceChipsProps) {
  const dark = isDark();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: dark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)',
        marginBottom: 8,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily: "'ABC Diatype Plus', sans-serif",
      }}>
        Sources
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sources.map((s) => {
          const isOpen = expandedIdx === s.index;
          const hasSnippet = !!s.snippet;
          return (
            <div key={s.index} style={{ position: 'relative' }}>
              {/* Chip row */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0,
                  borderRadius: 20,
                  background: isOpen
                    ? (dark ? 'rgba(234,88,12,0.14)' : 'rgba(234,88,12,0.09)')
                    : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  border: `1px solid ${isOpen
                    ? 'rgba(234,88,12,0.25)'
                    : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}`,
                  overflow: 'hidden',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Clickable body */}
                <button
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', `[${s.index}] ${s.title} — ${s.url}`);
                    e.dataTransfer.setData('application/x-neuro-source', JSON.stringify({ index: s.index, title: s.title, url: s.url, snippet: s.snippet }));
                  }}
                  onClick={() => setExpandedIdx(isOpen ? null : s.index)}
                  title={hasSnippet ? 'Click to preview · Drag to reference' : s.title || s.url}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px 4px 7px',
                    background: 'none',
                    border: 'none',
                    color: isOpen
                      ? (dark ? 'rgba(234,88,12,0.9)' : 'rgba(234,88,12,0.85)')
                      : (dark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)'),
                    fontSize: 11,
                    fontFamily: "'ABC Diatype Plus', sans-serif",
                    fontWeight: 500,
                    lineHeight: 1,
                    cursor: hasSnippet ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <img
                    src={faviconUrl(s.url)}
                    alt=""
                    width={13}
                    height={13}
                    style={{ borderRadius: 3, flexShrink: 0 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cleanDomain(s.url)}
                  </span>
                  <span style={{
                    fontSize: 9,
                    color: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                  }}>
                    [{s.index}]
                  </span>
                  {hasSnippet && (
                    <span style={{
                      fontSize: 8,
                      color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                      marginLeft: -2,
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      display: 'inline-block',
                      transition: 'transform 0.15s ease',
                    }}>▾</span>
                  )}
                </button>

                {/* External link icon */}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open source"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 8px 4px 2px',
                    color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)',
                    fontSize: 10,
                    textDecoration: 'none',
                    lineHeight: 1,
                    borderLeft: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                    paddingLeft: 6,
                    transition: 'color 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.color = dark ? 'rgba(234,88,12,0.8)' : 'rgba(234,88,12,0.7)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.color = dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';
                  }}
                >
                  ↗
                </a>
              </div>

              {/* Expanded snippet dropdown */}
              {isOpen && hasSnippet && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 50,
                  minWidth: 260,
                  maxWidth: 340,
                  background: dark ? 'rgba(18,18,24,0.97)' : 'rgba(255,255,255,0.98)',
                  border: `1px solid ${dark ? 'rgba(234,88,12,0.2)' : 'rgba(234,88,12,0.15)'}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  boxShadow: dark ? '0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.12)',
                  backdropFilter: 'blur(20px)',
                }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.75)',
                    fontFamily: "'ABC Diatype Plus', sans-serif",
                    marginBottom: 6,
                    lineHeight: 1.3,
                  }}>
                    {s.title}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.55)',
                    fontFamily: "'ABC Diatype Plus', sans-serif",
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}>
                    {s.snippet}
                  </div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 8,
                      fontSize: 10,
                      color: 'rgba(234,88,12,0.75)',
                      textDecoration: 'none',
                      fontFamily: "'ABC Diatype Plus', sans-serif",
                    }}
                  >
                    <img src={faviconUrl(s.url)} alt="" width={11} height={11} style={{ borderRadius: 2 }} />
                    {cleanDomain(s.url)} ↗
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   WeatherCard
   ──────────────────────────────────────────────────────── */

export interface WeatherCardProps {
  location: string;
  temperature: number;
  unit: 'C' | 'F';
  condition: string;
  humidity?: number;
  wind?: string;
}

function WeatherIcon({ condition, size = 48 }: { condition: string; size?: number }) {
  const c = condition.toLowerCase();
  if (c.includes('sun') || c.includes('clear')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="9" fill="#FBBF24" opacity="0.95"/>
        {[0,45,90,135,180,225,270,315].map(a => (
          <line key={a} x1={24+14*Math.cos((a-90)*Math.PI/180)} y1={24+14*Math.sin((a-90)*Math.PI/180)}
            x2={24+19*Math.cos((a-90)*Math.PI/180)} y2={24+19*Math.sin((a-90)*Math.PI/180)}
            stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
        ))}
      </svg>
    );
  }
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower') || c.includes('mist')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <path d="M12 26a10 10 0 0118.5-3.5A7.5 7.5 0 0138 26H12z" fill="#94A3B8"/>
        {[14,21,28,35].map((x, i) => <line key={x} x1={x} y1={32} x2={x-2} y2={40} stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" opacity={0.7+i*0.05}/>)}
      </svg>
    );
  }
  if (c.includes('snow') || c.includes('blizzard') || c.includes('sleet')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <path d="M12 26a10 10 0 0118.5-3.5A7.5 7.5 0 0138 26H12z" fill="#CBD5E1"/>
        {[14,20,26,32,38].map(x => <circle key={x} cx={x} cy={36} r="2" fill="#E2E8F0" opacity="0.9"/>)}
      </svg>
    );
  }
  if (c.includes('storm') || c.includes('thunder') || c.includes('lightning')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <path d="M10 24a10 10 0 0118.5-3.5A7.5 7.5 0 0136 24H10z" fill="#475569"/>
        <path d="M23 28l-4 8h5l-3 8 7-12h-5l4-4h-4z" fill="#FBBF24" opacity="0.95"/>
      </svg>
    );
  }
  if (c.includes('partly') || c.includes('partial') || c.includes('cloud')) {
    const mostly = c.includes('mostly') || c.includes('overcast');
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        {!mostly && <><circle cx="32" cy="18" r="7" fill="#FBBF24" opacity="0.9"/>{[0,45,90,135,180,225,270,315].map(a=><line key={a} x1={32+10*Math.cos((a-90)*Math.PI/180)} y1={18+10*Math.sin((a-90)*Math.PI/180)} x2={32+14*Math.cos((a-90)*Math.PI/180)} y2={18+14*Math.sin((a-90)*Math.PI/180)} stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>)}</>}
        <path d="M8 30a10 10 0 0118.5-3.5A7.5 7.5 0 0134 30H8z" fill={mostly ? '#64748B' : '#CBD5E1'}/>
        {mostly && <path d="M16 26a7 7 0 0113-2A5.5 5.5 0 0134 26H16z" fill="#94A3B8"/>}
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M8 30a10 10 0 0118.5-3.5A7.5 7.5 0 0134 30H8z" fill="#94A3B8"/>
      <path d="M16 26a7 7 0 0113-2A5.5 5.5 0 0134 26H16z" fill="#CBD5E1"/>
    </svg>
  );
}

// ── Widget: weather (from wttr.in JSON) ──
export interface WidgetWeatherData {
  city: string; country?: string;
  tempC: number; tempF: number; feelsC?: number;
  humidity?: number; windKm?: number; desc: string;
  visibility?: number; uvIndex?: number;
  maxC?: number; minC?: number;
}

export function WidgetWeatherCard({ data }: { data: WidgetWeatherData }) {
  const dark = isDark();
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const temp = unit === 'C' ? data.tempC : data.tempF;
  const feelsTemp = unit === 'C' ? (data.feelsC ?? data.tempC) : Math.round((data.feelsC ?? data.tempC) * 9/5 + 32);
  const accent = '#3b82f6';

  const statPill = (label: string, value: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '6px 10px', borderRadius: 8, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)', fontFamily: 'ui-monospace, monospace' }}>{value}</span>
      <span style={{ fontSize: 9, color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', fontFamily: "'ABC Diatype Plus', system-ui", textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );

  return (
    <div data-chart="true" style={{ ...glass(dark), padding: '16px 18px', margin: '8px 0', backdropFilter: 'blur(16px)', maxWidth: 420 }}>
      {/* Top row: icon + main temp */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
        <WeatherIcon condition={data.desc} size={52} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 42, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: dark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)', lineHeight: 1 }}>{temp}°</span>
            <button onClick={() => setUnit(u => u === 'C' ? 'F' : 'C')} style={{ fontSize: 14, fontWeight: 500, color: accent, cursor: 'pointer', background: 'none', border: 'none', padding: '0 2px', fontFamily: 'ui-monospace, monospace' }}>{unit}</button>
          </div>
          <div style={{ fontSize: 13, color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.58)', fontFamily: "'ABC Diatype Plus', system-ui", marginTop: 2, textTransform: 'capitalize' }}>{data.desc}</div>
          <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.4)', fontFamily: "'ABC Diatype Plus', system-ui", marginTop: 1 }}>
            {data.city}{data.country ? `, ${data.country}` : ''}{data.maxC !== null ? ` · H:${unit==='C'?data.maxC:Math.round(data.maxC!*9/5+32)}° L:${unit==='C'?data.minC:Math.round(data.minC!*9/5+32)}°` : ''}
          </div>
        </div>
      </div>
      {/* Stat pills row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {data.feelsC !== undefined && statPill('Feels like', `${feelsTemp}°${unit}`)}
        {data.humidity !== undefined && statPill('Humidity', `${data.humidity}%`)}
        {data.windKm !== undefined && statPill('Wind', `${data.windKm} km/h`)}
        {data.visibility !== undefined && statPill('Visibility', `${data.visibility} km`)}
        {data.uvIndex !== undefined && statPill('UV index', `${data.uvIndex}`)}
      </div>
    </div>
  );
}

// Legacy WeatherCard (kept for backward compat)
export function WeatherCard({ location, temperature, unit, condition, humidity, wind }: WeatherCardProps) {
  const dark = isDark();
  return (
    <div style={{ ...glass(dark), padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, maxWidth: 340, margin: '8px 0', backdropFilter: 'blur(12px)' }}>
      <WeatherIcon condition={condition} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)', lineHeight: 1 }}>{temperature}&deg;{unit}</div>
        <div style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', fontFamily: "'ABC Diatype Plus', sans-serif", marginTop: 2, textTransform: 'capitalize' }}>{condition}</div>
        <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.4)', fontFamily: "'ABC Diatype Plus', sans-serif", marginTop: 1 }}>{location}</div>
        {(humidity !== undefined || wind) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', fontFamily: "'ABC Diatype Plus', sans-serif" }}>
            {humidity !== undefined && <span>Humidity {humidity}%</span>}
            {wind && <span>Wind {wind}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   TimeCard — instant time widget
   ──────────────────────────────────────────────────────── */

export interface WidgetTimeData {
  city: string;
  time: string;    // "3:45 PM"
  time24: string;  // "15:45"
  date: string;    // "Wednesday, Mar 26"
  timezone: string;
  offset: string;  // "+01:00"
  dst?: boolean;
}

export function WidgetTimeCard({ data }: { data: WidgetTimeData }) {
  const dark = isDark();
  const [use24, setUse24] = useState(false);
  const displayed = use24 ? data.time24 : data.time;
  const [h, m] = displayed.split(':');
  const ampm = !use24 ? (data.time.includes('AM') ? 'AM' : 'PM') : null;

  return (
    <div data-chart="true" style={{ ...glass(dark), padding: '16px 20px', margin: '8px 0', backdropFilter: 'blur(16px)', maxWidth: 320 }}>
      {/* Clock face */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 48, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: dark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)', lineHeight: 1, letterSpacing: '-0.02em' }}>{h}:{m}</span>
        {ampm && <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: '#3b82f6', paddingBottom: 6, letterSpacing: '0.02em' }}>{ampm}</span>}
        <button onClick={() => setUse24(u => !u)} style={{ fontSize: 10, color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', cursor: 'pointer', background: 'none', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 4, padding: '2px 5px', fontFamily: "'ABC Diatype Plus', system-ui", marginBottom: 4 }}>
          {use24 ? '12h' : '24h'}
        </button>
      </div>
      <div style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: "'ABC Diatype Plus', system-ui" }}>{data.date}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <span style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.38)', fontFamily: "'ABC Diatype Plus', system-ui" }}>
          {data.city} · {data.timezone.split('/').pop()?.replace(/_/g, ' ')} (UTC{data.offset})
        </span>
        {data.dst && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#3b82f620', color: '#3b82f6', fontFamily: "'ABC Diatype Plus', system-ui", fontWeight: 600 }}>DST</span>}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   StatCard
   ──────────────────────────────────────────────────────── */

export interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}

export function StatCard({ label, value, change, positive }: StatCardProps) {
  const dark = isDark();
  return (
    <div style={{
      ...glass(dark),
      padding: '14px 18px',
      display: 'inline-flex',
      flexDirection: 'column',
      minWidth: 120,
      margin: '4px 0',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        fontSize: 24,
        fontWeight: 600,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        color: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
        lineHeight: 1.1,
      }}>
        {value}
        {change && (
          <span style={{
            fontSize: 12,
            fontWeight: 500,
            marginLeft: 8,
            color: positive ? '#22c55e' : positive === false ? '#ef4444' : (dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'),
          }}>
            {change}
          </span>
        )}
      </div>
      <div style={{
        fontSize: 11,
        color: dark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.4)',
        fontFamily: "'ABC Diatype Plus', sans-serif",
        marginTop: 4,
        fontWeight: 500,
      }}>
        {label}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   ComparisonBar
   ──────────────────────────────────────────────────────── */

export interface ComparisonBarProps {
  items: Array<{ label: string; value: number; color?: string }>;
  unit?: string;
}

const defaultColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

export function ComparisonBar({ items, unit }: ComparisonBarProps) {
  const dark = isDark();
  const maxVal = useMemo(() => Math.max(...items.map(i => i.value), 1), [items]);

  return (
    <div style={{
      ...glass(dark),
      padding: '14px 18px',
      margin: '8px 0',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, idx) => {
          const pct = (item.value / maxVal) * 100;
          const color = item.color || defaultColors[idx % defaultColors.length];
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 80,
                fontSize: 11,
                color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                fontFamily: "'ABC Diatype Plus', sans-serif",
                fontWeight: 500,
                textAlign: 'right',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {item.label}
              </div>
              <div style={{
                flex: 1,
                height: 18,
                borderRadius: 4,
                background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 4,
                  background: color,
                  opacity: 0.75,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{
                width: 60,
                fontSize: 11,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
                textAlign: 'right',
                flexShrink: 0,
              }}>
                {item.value.toLocaleString()}{unit ? ` ${unit}` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   ChartBlock — renders agent-emitted ```chart JSON blocks
   ──────────────────────────────────────────────────────── */

export interface ChartSeriesPoint {
  x: string | number;
  y: number;
  z?: number;
  label?: string;
}

export interface ChartSeries {
  name: string;
  color?: string;
  data: ChartSeriesPoint[];
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'heatmap' | 'donut';
  title?: string;
  subtitle?: string;
  series: ChartSeries[];
  xAxis?: { label?: string };
  yAxis?: { label?: string; unit?: string };
  source?: string;
  sources?: Array<{ title: string; url: string }>;
  horizontal?: boolean;
}

const CHART_PALETTE = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#6366f1','#f97316','#14b8a6'];

function downloadCSV(spec: ChartSpec) {
  const rows: string[] = ['series,x,y'];
  for (const s of spec.series) {
    for (const d of s.data) {
      rows.push(`"${s.name}","${d.x}",${d.y}`);
    }
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(spec.title || 'chart').replace(/\s+/g, '_')}.csv`;
  a.click();
}

/** Download chart as PNG screenshot using canvas rendering */
async function downloadChartPNG(spec: ChartSpec, containerRef: HTMLDivElement | null) {
  if (!containerRef) return;

  try {
    // Dynamically import html2canvas if not already loaded
    const html2canvas = (window as any).html2canvas || (await import('html2canvas').then(m => m.default));

    const canvas = await html2canvas(containerRef, {
      backgroundColor: '#ffffff',
      scale: 2,
      allowTaint: true,
      useCORS: true,
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${(spec.title || 'chart').replace(/\s+/g, '_')}.png`;
    link.click();
  } catch (err) {
    // Fallback: if html2canvas not available, just use canvas toDataURL from SVG
    console.warn('PNG export unavailable, ensure html2canvas is installed', err);
  }
}

// Flatten first series into recharts-compatible {x, ...seriesName} format
function flattenSeries(series: ChartSeries[]) {
  const map = new Map<string, Record<string, number | string>>();
  for (const s of series) {
    for (const d of s.data) {
      const key = String(d.x);
      if (!map.has(key)) map.set(key, { x: d.x });
      map.get(key)![s.name] = d.y;
    }
  }
  return Array.from(map.values());
}

const CustomTooltipStyle: React.CSSProperties = {
  background: 'rgba(10,10,18,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  fontFamily: "'ABC Diatype Plus', system-ui",
  color: 'rgba(255,255,255,0.85)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

export function ChartBlock({ spec }: { spec: ChartSpec }) {
  const dark = isDark();
  const axisColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const chartData = flattenSeries(spec.series);
  const unit = spec.yAxis?.unit || '';
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  const handleCopyData = async () => {
    const csvData: string[] = ['series,x,y'];
    for (const s of spec.series) {
      for (const d of s.data) {
        csvData.push(`"${s.name}","${d.x}",${d.y}`);
      }
    }
    const text = csvData.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const tooltipContent = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={CustomTooltipStyle}>
        {label && <div style={{ marginBottom: 4, opacity: 0.6, fontSize: 10 }}>{label}</div>}
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill }} />
            <span style={{ opacity: 0.7, fontSize: 10 }}>{p.name}:</span>
            <span style={{ fontWeight: 600 }}>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{unit}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderChart = () => {
    const commonAxis = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="x" tick={{ fill: axisColor, fontSize: 10 }} axisLine={{ stroke: gridColor }} tickLine={false}
          label={spec.xAxis?.label ? { value: spec.xAxis.label, position: 'insideBottom', offset: -4, fill: axisColor, fontSize: 10 } : undefined}
        />
        <YAxis tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => `${v.toLocaleString()}${unit}`}
          label={spec.yAxis?.label ? { value: spec.yAxis.label, angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 10 } : undefined}
        />
        <Tooltip content={tooltipContent} cursor={{ fill: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
        {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: axisColor }} />}
      </>
    );

    switch (spec.type) {
      case 'bar':
        return (
          <BarChart data={chartData} layout={spec.horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            {commonAxis}
            {spec.series.map((s, i) => (
              <Bar key={s.name} dataKey={s.name} fill={s.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                radius={[3, 3, 0, 0]} opacity={0.85} maxBarSize={48} />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            {commonAxis}
            {spec.series.map((s, i) => (
              <Line key={s.name} type="monotone" dataKey={s.name}
                stroke={s.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={2} dot={chartData.length > 20 ? false : { r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }} />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            {commonAxis}
            {spec.series.map((s, i) => {
              const color = s.color || CHART_PALETTE[i % CHART_PALETTE.length];
              return (
                <Area key={s.name} type="monotone" dataKey={s.name}
                  stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2}
                  dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              );
            })}
          </AreaChart>
        );

      case 'pie':
      case 'donut': {
        const pieData = spec.series[0]?.data.map(d => ({ name: String(d.x), value: d.y })) || [];
        const isDonut = spec.type === 'donut';
        return (
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie data={pieData} dataKey="value" nameKey="name"
              cx="50%" cy="50%" outerRadius={100} innerRadius={isDonut ? 55 : 0}
              paddingAngle={isDonut ? 3 : 1} strokeWidth={0}>
              {pieData.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} opacity={0.88} />
              ))}
            </Pie>
            <Tooltip content={tooltipContent} />
            <Legend wrapperStyle={{ fontSize: 11, color: axisColor }} />
          </PieChart>
        );
      }

      case 'scatter':
        return (
          <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis type="number" dataKey="x" name={spec.xAxis?.label || 'x'}
              tick={{ fill: axisColor, fontSize: 10 }} axisLine={{ stroke: gridColor }} tickLine={false} />
            <YAxis type="number" dataKey="y" name={spec.yAxis?.label || 'y'}
              tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `${v.toLocaleString()}${unit}`} />
            <Tooltip content={tooltipContent} cursor={{ strokeDasharray: '3 3', stroke: gridColor }} />
            {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: axisColor }} />}
            {spec.series.map((s, i) => (
              <Scatter key={s.name} name={s.name}
                data={s.data.map(d => ({ x: d.x, y: d.y, z: d.z }))}
                fill={s.color || CHART_PALETTE[i % CHART_PALETTE.length]} opacity={0.75} />
            ))}
          </ScatterChart>
        );

      case 'heatmap': {
        // Custom SVG heatmap — recharts has no native support
        const allRows = [...new Set(spec.series.map(s => s.name))];
        const allCols = [...new Set(spec.series.flatMap(s => s.data.map(d => String(d.x))))];
        const vals = spec.series.flatMap(s => s.data.map(d => d.y));
        const minV = Math.min(...vals), maxV = Math.max(...vals);
        const norm = (v: number) => maxV === minV ? 0.5 : (v - minV) / (maxV - minV);
        const cellW = Math.max(40, Math.min(80, Math.floor(380 / allCols.length)));
        const cellH = 32;
        return (
          <div style={{ overflowX: 'auto', fontSize: 10, fontFamily: "'ABC Diatype Plus', system-ui" }}>
            <svg width={cellW * allCols.length + 70} height={cellH * allRows.length + 28}>
              {/* Column headers */}
              {allCols.map((col, ci) => (
                <text key={ci} x={70 + ci * cellW + cellW / 2} y={14} textAnchor="middle"
                  fill={axisColor} fontSize={9}>{col}</text>
              ))}
              {allRows.map((row, ri) => {
                const series = spec.series.find(s => s.name === row);
                return (
                  <g key={ri}>
                    <text x={64} y={28 + ri * cellH + cellH / 2} textAnchor="end" dominantBaseline="middle"
                      fill={axisColor} fontSize={9}>{row}</text>
                    {allCols.map((col, ci) => {
                      const point = series?.data.find(d => String(d.x) === col);
                      const n = point ? norm(point.y) : 0;
                      const bg = `hsl(${220 - n * 180}, ${50 + n * 40}%, ${20 + n * 35}%)`;
                      return (
                        <g key={ci}>
                          <rect x={70 + ci * cellW} y={20 + ri * cellH} width={cellW - 2} height={cellH - 4}
                            rx={3} fill={bg} />
                          {point && <text x={70 + ci * cellW + cellW / 2} y={20 + ri * cellH + cellH / 2 - 2}
                            textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.85)" fontSize={9}>
                            {point.y.toLocaleString()}{unit}
                          </text>}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} data-chart="true" style={{
      ...glass(dark),
      padding: '14px 16px 10px',
      margin: '10px 0',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div>
          {spec.title && (
            <div style={{ fontSize: 13, fontWeight: 600, color: dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)', fontFamily: "'ABC Diatype Plus', system-ui", lineHeight: 1.3 }}>
              {spec.title}
            </div>
          )}
          {spec.subtitle && (
            <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontFamily: "'ABC Diatype Plus', system-ui", marginTop: 2 }}>
              {spec.subtitle}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleCopyData}
            title="Copy chart data"
            style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: copied ? 'rgba(34,197,94,0.15)' : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)')}`, color: copied ? 'rgba(34,197,94,0.8)' : (dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'), cursor: 'pointer', fontFamily: "'ABC Diatype Plus', system-ui", transition: 'all 0.2s' }}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button
            onClick={() => downloadCSV(spec)}
            title="Export CSV"
            style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`, color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', cursor: 'pointer', fontFamily: "'ABC Diatype Plus', system-ui" }}
          >
            ↓ CSV
          </button>
          <button
            onClick={() => downloadChartPNG(spec, containerRef.current)}
            title="Export PNG"
            style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`, color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', cursor: 'pointer', fontFamily: "'ABC Diatype Plus', system-ui" }}
          >
            📸 PNG
          </button>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        {renderChart() || <div />}
      </ResponsiveContainer>

      {/* Source attribution */}
      {spec.source && (
        <div style={{ fontSize: 10, color: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.28)', fontFamily: "'ABC Diatype Plus', system-ui", marginTop: 8, fontStyle: 'italic' }}>
          Source: {spec.source}
        </div>
      )}

      {/* Sources with favicons */}
      {spec.sources && spec.sources.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {spec.sources.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: 11,
                  color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
                  e.currentTarget.style.color = dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
                  e.currentTarget.style.color = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
                }}
              >
                <img
                  src={faviconUrl(source.url)}
                  alt={source.title}
                  style={{ width: 16, height: 16, borderRadius: 3 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span>{cleanDomain(source.url)}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Sparkline — Mini inline chart for quick data visualization
   ──────────────────────────────────────────────────────── */

export interface SparklineProps {
  data: Array<{ x: string | number; y: number }>;
  color?: string;
  height?: number;
  width?: number;
}

export function Sparkline({ data, color = '#3b82f6', height = 24, width = 120 }: SparklineProps) {
  if (!data || data.length === 0) return null;

  const values = data.map(d => d.y);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal === minVal ? 1 : maxVal - minVal;

  // Normalize to 0-1
  const normalized = values.map(v => (v - minVal) / range);

  // Generate SVG path
  const padding = 2;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const stepX = plotWidth / (normalized.length - 1 || 1);

  let pathD = '';
  normalized.forEach((y, i) => {
    const x = padding + i * stepX;
    const plotY = padding + plotHeight * (1 - y);
    pathD += `${i === 0 ? 'M' : 'L'} ${x} ${plotY}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}
    >
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
