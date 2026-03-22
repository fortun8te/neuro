import { useState, useRef, useEffect, useMemo } from "react";

interface MemoriesManagerProps {
  memories: Array<{ key: string; content: string }>;
  onClose: () => void;
  onDelete?: (index: number) => void;
}

/** Color map for memory key badges */
function getKeyColor(key: string): string {
  const colors: Record<string, string> = {
    brand: "rgba(43,121,255,0.7)",
    audience: "rgba(34,197,94,0.7)",
    competitor: "rgba(251,146,60,0.7)",
    product: "rgba(168,85,247,0.7)",
    tone: "rgba(236,72,153,0.7)",
    insight: "rgba(14,165,233,0.7)",
    objection: "rgba(239,68,68,0.7)",
    desire: "rgba(234,179,8,0.7)",
  };
  const lower = key.toLowerCase();
  for (const [k, c] of Object.entries(colors)) {
    if (lower.includes(k)) return c;
  }
  return "rgba(168,85,247,0.6)";
}

export function MemoriesManager({ memories, onClose, onDelete }: MemoriesManagerProps) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return memories.map((m, i) => ({ ...m, _idx: i }));
    const q = search.toLowerCase();
    return memories
      .map((m, i) => ({ ...m, _idx: i }))
      .filter(m => m.key.toLowerCase().includes(q) || m.content.toLowerCase().includes(q));
  }, [memories, search]);

  return (
    <div
      className="overflow-hidden"
      style={{
        width: 340,
        maxWidth: '100%',
        background: "rgba(12,12,16,0.95)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold" style={{ color: "rgba(168,85,247,0.8)" }}>
            Session Memory
          </span>
          <span className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.25)" }}>
            {memories.length} {memories.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/[0.05] transition-colors"
          style={{ color: "rgba(255,255,255,0.25)" }}
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex-1 relative">
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search memories..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-2 rounded text-[11px] outline-none"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.7)",
            }}
          />
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: "calc(50vh - 120px)" }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
              {search ? "No memories match your search" : "No memories stored"}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((m) => (
              <div
                key={m._idx}
                className="px-3 py-2.5 hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded mb-1"
                      style={{
                        color: getKeyColor(m.key),
                        background: `${getKeyColor(m.key)}12`,
                        border: `1px solid ${getKeyColor(m.key)}20`,
                      }}
                    >
                      {m.key}
                    </span>
                    <p
                      className="text-[11px] leading-relaxed mt-0.5"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      {m.content.length > 200 ? m.content.slice(0, 200) + "..." : m.content}
                    </p>
                  </div>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(m._idx)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-white/[0.06] transition-all shrink-0 mt-0.5"
                      style={{ color: "rgba(255,255,255,0.2)" }}
                      title="Remove memory"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
