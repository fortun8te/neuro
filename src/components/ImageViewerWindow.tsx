/**
 * ImageViewerWindow -- simple image viewer for screenshots, ad previews, etc.
 *
 * - macOS-style window with traffic lights, draggable title bar
 * - Single image display with object-fit: contain
 * - Zoom controls: +/- buttons, fit-to-window, actual size
 * - Pan: click and drag when zoomed in
 * - Info bar at bottom: filename, dimensions, file size
 * - Opens via desktopBus: open_image event
 * - Supported formats: PNG, JPEG, WebP, GIF, SVG
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useWindowDrag } from '../hooks/useWindowDrag';

// -- Traffic Lights ----------------------------------------------------------

function TrafficLights({ onClose }: { onClose: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="flex items-center gap-[6px]" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button onClick={onClose} className="w-3 h-3 rounded-full flex items-center justify-center" style={{ background: '#FF5F57', border: '0.5px solid rgba(0,0,0,0.25)', cursor: 'pointer' }}>
        {hovered && <svg width="6" height="6" viewBox="0 0 10 10" fill="none"><line x1="2" y1="2" x2="8" y2="8" stroke="#7a1a16" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="2" x2="2" y2="8" stroke="#7a1a16" strokeWidth="1.5" strokeLinecap="round" /></svg>}
      </button>
      <button className="w-3 h-3 rounded-full flex items-center justify-center" style={{ background: '#FEBC2E', border: '0.5px solid rgba(0,0,0,0.25)', cursor: 'pointer' }}>
        {hovered && <svg width="6" height="6" viewBox="0 0 10 10" fill="none"><line x1="2" y1="5" x2="8" y2="5" stroke="#7a5200" strokeWidth="1.5" strokeLinecap="round" /></svg>}
      </button>
      <button className="w-3 h-3 rounded-full flex items-center justify-center" style={{ background: '#28C840', border: '0.5px solid rgba(0,0,0,0.25)', cursor: 'pointer' }}>
        {hovered && <svg width="6" height="6" viewBox="0 0 10 10" fill="none"><line x1="2" y1="2" x2="8" y2="8" stroke="#0c4a1c" strokeWidth="1.3" strokeLinecap="round" /><line x1="8" y1="2" x2="2" y2="8" stroke="#0c4a1c" strokeWidth="1.3" strokeLinecap="round" /></svg>}
      </button>
    </div>
  );
}

// -- Component ---------------------------------------------------------------

export function ImageViewerWindow({
  onClose,
  zIndex,
  onFocus,
  src,
  name,
}: {
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
  src: string;
  name?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    windowRef,
    pos,
    isDragging,
    onTitleBarMouseDown,
  } = useWindowDrag({ windowWidth: 640, windowHeight: 520, centerOffset: { x: 30, y: 20 } });

  const filename = name ?? 'image';

  // Estimate file size from base64 data URL
  useEffect(() => {
    if (src.startsWith('data:')) {
      const base64 = src.split(',')[1];
      if (base64) {
        const bytes = Math.ceil(base64.length * 0.75);
        if (bytes > 1024 * 1024) setFileSize(`${(bytes / (1024 * 1024)).toFixed(1)} MB`);
        else if (bytes > 1024) setFileSize(`${(bytes / 1024).toFixed(0)} KB`);
        else setFileSize(`${bytes} B`);
      }
    }
  }, [src]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(z => Math.min(z * 1.25, 8));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(z => Math.max(z / 1.25, 0.1));
  }, []);

  const fitToWindow = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const actualSize = useCallback(() => {
    if (!naturalSize || !containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    // Calculate what zoom would make the image show at natural size
    // Default object-fit: contain fits the image, so zoom=1 means "fit"
    // We want zoom such that rendered size = natural size
    const fitScale = Math.min(containerW / naturalSize.w, containerH / naturalSize.h);
    const targetZoom = 1 / fitScale;
    setZoom(targetZoom);
    setPanOffset({ x: 0, y: 0 });
  }, [naturalSize]);

  // Pan handling
  const onPanStart = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
  }, [zoom, panOffset]);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPanOffset({ x: panStart.current.ox + dx, y: panStart.current.oy + dy });
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

  // Mouse wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(z => Math.max(0.1, Math.min(z * factor, 8)));
  }, []);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <motion.div
      ref={windowRef}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseDownCapture={onFocus}
      style={{
        position: 'absolute',
        ...(pos !== null
          ? { left: pos.x, top: pos.y, transform: 'none' }
          : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        ),
        width: 640,
        height: 520,
        maxWidth: 'calc(100% - 8px)',
        maxHeight: 'calc(100% - 8px)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: zIndex ?? 200,
        pointerEvents: 'auto',
        background: '#0e0e12',
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Title bar */}
      <div
        onMouseDown={onTitleBarMouseDown}
        style={{
          height: 36, display: 'flex', alignItems: 'center', paddingLeft: 14, paddingRight: 14,
          background: '#1c1c1e', borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0, cursor: isDragging ? 'grabbing' : 'grab', position: 'relative',
        }}
      >
        <TrafficLights onClose={onClose} />
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filename}
        </div>

        {/* Zoom controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={zoomOut} style={zoomBtnStyle} title="Zoom out">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', minWidth: 30, textAlign: 'center' }}>{zoomPercent}%</span>
          <button onClick={zoomIn} style={zoomBtnStyle} title="Zoom in">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
          <button onClick={fitToWindow} style={zoomBtnStyle} title="Fit to window">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          </button>
          <button onClick={actualSize} style={zoomBtnStyle} title="Actual size">
            <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>1:1</span>
          </button>
        </div>
      </div>

      {/* Image viewport */}
      <div
        ref={containerRef}
        onMouseDown={onPanStart}
        onWheel={onWheel}
        style={{
          flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
          background: '#0a0a0e',
        }}
      >
        <img
          src={src}
          alt={filename}
          onLoad={handleImageLoad}
          draggable={false}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.1s ease',
            imageRendering: zoom > 2 ? 'pixelated' : 'auto',
          }}
        />
      </div>

      {/* Info bar */}
      <div style={{
        height: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', background: '#141418', borderTop: '1px solid rgba(255,255,255,0.04)',
        fontSize: 9, color: 'rgba(255,255,255,0.3)', flexShrink: 0,
      }}>
        <span>{filename}</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {naturalSize && <span>{naturalSize.w} x {naturalSize.h}</span>}
          {fileSize && <span>{fileSize}</span>}
        </div>
      </div>
    </motion.div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 4,
  width: 22, height: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.4)',
};
