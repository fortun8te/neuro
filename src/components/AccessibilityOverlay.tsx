/**
 * AccessibilityOverlay — canvas overlay showing interactive AX tree elements
 * as colored bounding boxes over the live browser stream.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { INFRASTRUCTURE } from '../config/infrastructure';

// ── Types ──────────────────────────────────────────────

export interface AXNode {
  role: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number } | null;
  nodeId?: string;
}

interface AccessibilityOverlayProps {
  sessionId: string | null;
  streamWidth: number;
  streamHeight: number;
  enabled: boolean;
}

// ── Role colors ────────────────────────────────────────

function colorForRole(role: string): string {
  const r = role.toLowerCase();
  if (r === 'button') return '#ff6b35';
  if (r === 'link') return '#3b82f6';
  if (r === 'textbox' || r === 'searchbox' || r === 'input') return '#22c55e';
  if (r === 'heading') return '#a855f7';
  return '#9ca3af';
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// AX viewport size (Playwright default)
const AX_WIDTH = 1280;
const AX_HEIGHT = 800;

// ── Component ──────────────────────────────────────────

export function AccessibilityOverlay({
  sessionId,
  streamWidth,
  streamHeight,
  enabled,
}: AccessibilityOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<AXNode[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; role: string; name: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNodes = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(
        `${INFRASTRUCTURE.wayfarerUrl}/session/${sessionId}/accessibility`,
      );
      if (!res.ok) return;
      const data = await res.json() as { nodes?: AXNode[] } | AXNode[];
      const list: AXNode[] = Array.isArray(data) ? data : (data as { nodes?: AXNode[] }).nodes ?? [];
      setNodes(list);
    } catch {
      // Wayfarer not reachable — leave stale nodes
    }
  }, [sessionId]);

  // Start / stop polling
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!enabled || !sessionId) {
      setNodes([]);
      return;
    }
    fetchNodes();
    intervalRef.current = setInterval(fetchNodes, 2000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, sessionId, fetchNodes]);

  // Draw boxes onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!enabled || nodes.length === 0) return;

    const scaleX = streamWidth / AX_WIDTH;
    const scaleY = streamHeight / AX_HEIGHT;

    nodes.forEach(node => {
      if (!node.bounds) return;
      const { x, y, width, height } = node.bounds;
      const sx = x * scaleX;
      const sy = y * scaleY;
      const sw = width * scaleX;
      const sh = height * scaleY;
      if (sw < 1 || sh < 1) return;

      const color = colorForRole(node.role);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = hexToRgba(color, 0.15);
      ctx.beginPath();
      ctx.rect(sx, sy, sw, sh);
      ctx.fill();
      ctx.stroke();
    });
  }, [nodes, enabled, streamWidth, streamHeight]);

  // Tooltip on mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!enabled || nodes.length === 0) { setTooltip(null); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const scaleX = streamWidth / AX_WIDTH;
    const scaleY = streamHeight / AX_HEIGHT;

    // Find topmost node whose scaled bounds contain the cursor
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (!node.bounds) continue;
      const sx = node.bounds.x * scaleX;
      const sy = node.bounds.y * scaleY;
      const sw = node.bounds.width * scaleX;
      const sh = node.bounds.height * scaleY;
      if (mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sh) {
        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, role: node.role, name: node.name });
        return;
      }
    }
    setTooltip(null);
  }, [enabled, nodes, streamWidth, streamHeight]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 15,
      }}
    >
      <canvas
        ref={canvasRef}
        width={streamWidth}
        height={streamHeight}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
          cursor: 'default',
        }}
      />

      {/* Tooltip — clamped so it stays within the overlay bounds */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(tooltip.x + 12, streamWidth - 270),
            top: tooltip.y + 12 + 24 > streamHeight ? tooltip.y - 28 : tooltip.y + 12,
            background: 'rgba(10,10,14,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 5,
            padding: '4px 8px',
            fontSize: 10,
            fontFamily: 'ui-monospace, monospace',
            color: 'rgba(255,255,255,0.85)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(8px)',
            zIndex: 20,
            maxWidth: 260,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ color: colorForRole(tooltip.role), fontWeight: 600 }}>
            {tooltip.role}
          </span>
          {tooltip.name ? (
            <span style={{ color: 'rgba(255,255,255,0.55)', marginLeft: 6 }}>
              {tooltip.name.length > 40 ? tooltip.name.slice(0, 40) + '…' : tooltip.name}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
