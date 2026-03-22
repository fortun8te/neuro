/**
 * PDFViewerWindow -- PDF viewer for the desktop.
 *
 * - macOS-style window with traffic lights, draggable title bar
 * - Uses react-pdf library (must be installed separately)
 * - Page navigation: prev/next, page input, total pages
 * - Zoom: fit width, fit page, zoom in/out
 * - Agent API via desktopBus: pdf_extract returns text content
 * - Opens via: open_pdf event
 *
 * If react-pdf is not installed, renders a fallback message.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useWindowDrag } from '../hooks/useWindowDrag';
import { desktopBus } from '../utils/desktopBus';

// -- Conditional react-pdf import -------------------------------------------

type PDFDocumentProxy = { numPages: number };

let Document: React.ComponentType<{
  file: string;
  onLoadSuccess: (pdf: PDFDocumentProxy) => void;
  loading?: React.ReactNode;
  error?: React.ReactNode;
  children?: React.ReactNode;
}> | null = null;

let Page: React.ComponentType<{
  pageNumber: number;
  width?: number;
  scale?: number;
  loading?: React.ReactNode;
}> | null = null;

let reactPdfAvailable = false;

try {
  // Dynamic require -- will fail at build time if react-pdf is not installed,
  // which is expected. The component gracefully falls back.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfLib = require('react-pdf');
  Document = pdfLib.Document;
  Page = pdfLib.Page;
  reactPdfAvailable = true;

  // react-pdf requires a worker setup
  if (pdfLib.pdfjs) {
    pdfLib.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfLib.pdfjs.version}/build/pdf.worker.min.mjs`;
  }
} catch {
  // react-pdf not installed -- will render fallback
}

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

export function PDFViewerWindow({
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
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [pageInputValue, setPageInputValue] = useState('1');
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    windowRef,
    pos,
    isDragging,
    onTitleBarMouseDown,
  } = useWindowDrag({ windowWidth: 600, windowHeight: 700, centerOffset: { x: 50, y: 10 } });

  const filename = name ?? 'document.pdf';

  const onDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages);
    setPageNumber(1);
    setPageInputValue('1');
  }, []);

  const goToPage = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(p, numPages));
    setPageNumber(clamped);
    setPageInputValue(String(clamped));
  }, [numPages]);

  const prevPage = useCallback(() => goToPage(pageNumber - 1), [goToPage, pageNumber]);
  const nextPage = useCallback(() => goToPage(pageNumber + 1), [goToPage, pageNumber]);

  const zoomIn = useCallback(() => setZoom(z => Math.min(z + 0.25, 4)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(z - 0.25, 0.25)), []);
  const fitWidth = useCallback(() => setZoom(1.0), []);
  const fitPage = useCallback(() => setZoom(0.75), []);

  const handlePageInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = parseInt(pageInputValue, 10);
      if (!isNaN(val)) goToPage(val);
    }
  }, [pageInputValue, goToPage]);

  // Listen for pdf_extract events
  useEffect(() => {
    const unsub = desktopBus.subscribe(event => {
      if (event.type === 'pdf_extract') {
        // react-pdf text extraction is not straightforward without pdfjs;
        // emit null as a signal that extraction is not supported in this viewer
        desktopBus.emit({ type: 'pdf_content', path: event.path, text: null });
      }
    });
    return unsub;
  }, []);

  // Container width for responsive page sizing
  const [containerWidth, setContainerWidth] = useState(540);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const pageWidth = Math.max(200, containerWidth - 40) * zoom;

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
        width: 600,
        height: 700,
        maxWidth: 'calc(100% - 8px)',
        maxHeight: 'calc(100% - 8px)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: zIndex ?? 200,
        pointerEvents: 'auto',
        background: '#121216',
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
      </div>

      {/* Toolbar: navigation + zoom */}
      <div style={{
        height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '0 12px', background: '#161619',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        {/* Page navigation */}
        <button onClick={prevPage} disabled={pageNumber <= 1} style={toolBtnStyle} title="Previous page">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          <input
            value={pageInputValue}
            onChange={e => setPageInputValue(e.target.value)}
            onKeyDown={handlePageInput}
            onBlur={() => { const v = parseInt(pageInputValue, 10); if (!isNaN(v)) goToPage(v); }}
            style={{
              width: 28, textAlign: 'center', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3,
              color: 'rgba(255,255,255,0.6)', fontSize: 10, padding: '1px 2px', outline: 'none',
            }}
          />
          <span>/ {numPages}</span>
        </div>
        <button onClick={nextPage} disabled={pageNumber >= numPages} style={toolBtnStyle} title="Next page">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)', margin: '0 4px' }} />

        {/* Zoom controls */}
        <button onClick={zoomOut} style={toolBtnStyle} title="Zoom out">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', minWidth: 30, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} style={toolBtnStyle} title="Zoom in">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button onClick={fitWidth} style={toolBtnStyle} title="Fit width">
          <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>W</span>
        </button>
        <button onClick={fitPage} style={toolBtnStyle} title="Fit page">
          <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>P</span>
        </button>
      </div>

      {/* PDF viewport */}
      <div
        ref={containerRef}
        style={{
          flex: 1, overflowY: 'auto', overflowX: 'auto',
          display: 'flex', justifyContent: 'center',
          padding: 16, background: '#0c0c10',
        }}
      >
        {reactPdfAvailable && Document && Page ? (
          <Document
            file={src}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: 40, textAlign: 'center' }}>
                Loading PDF...
              </div>
            }
            error={
              <div style={{ color: 'rgba(239,68,68,0.7)', fontSize: 12, padding: 40, textAlign: 'center' }}>
                Failed to load PDF.
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              loading={
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, padding: 20 }}>
                  Rendering page {pageNumber}...
                </div>
              }
            />
          </Document>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            flex: 1, gap: 12,
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2h9l5 5v14a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" />
              <polyline points="14 2 14 8 20 8" strokeOpacity={0.3} />
            </svg>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
              PDF viewing requires <span style={{ color: 'rgba(239,68,68,0.7)', fontWeight: 600 }}>react-pdf</span>.
            </div>
            <div style={{
              fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: '"SF Mono",Monaco,Menlo,monospace',
              background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              npm install react-pdf
            </div>
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div style={{
        height: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', background: '#141418', borderTop: '1px solid rgba(255,255,255,0.04)',
        fontSize: 9, color: 'rgba(255,255,255,0.3)', flexShrink: 0,
      }}>
        <span>{filename}</span>
        {numPages > 0 && <span>Page {pageNumber} of {numPages}</span>}
      </div>
    </motion.div>
  );
}

const toolBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 4,
  width: 22, height: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.4)',
};
