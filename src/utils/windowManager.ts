/**
 * windowManager.ts — Pure in-memory window state management (no React)
 *
 * Provides a reactive store for macOS-style window management.
 * Consumers subscribe via addListener() and are notified on every state change.
 */

export interface WindowState {
  id: string
  appId: 'finder' | 'chrome' | 'terminal' | string
  title: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  minimized: boolean
  maximized: boolean
  isActive: boolean
}

export interface DefaultSize {
  width: number
  height: number
}

// ── Internal store ────────────────────────────────────────────────────────────

let windows: WindowState[] = []
let nextZIndex = 100
let nextId = 1
const listeners: Set<() => void> = new Set()

function notify() {
  listeners.forEach(fn => fn())
}

function snapshot(): WindowState[] {
  return [...windows]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWindow(id: string): WindowState | undefined {
  return windows.find(w => w.id === id)
}

function updateWindow(id: string, patch: Partial<WindowState>) {
  windows = windows.map(w => (w.id === id ? { ...w, ...patch } : w))
}

/** Cascade offset so stacked windows don't perfectly overlap */
function cascadeOffset(index: number): { x: number; y: number } {
  const base = 60
  const step = 28
  return { x: base + (index % 8) * step, y: base + (index % 8) * step }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function openWindow(
  appId: string,
  title: string,
  defaultSize: DefaultSize = { width: 720, height: 480 }
): WindowState {
  // Bring existing window of same appId to front instead of opening a duplicate
  const existing = windows.find(w => w.appId === appId)
  if (existing) {
    focusWindow(existing.id)
    return getWindow(existing.id)!
  }

  const id = `win-${nextId++}`
  const { x, y } = cascadeOffset(windows.length)

  const win: WindowState = {
    id,
    appId,
    title,
    x,
    y,
    width: defaultSize.width,
    height: defaultSize.height,
    zIndex: nextZIndex++,
    minimized: false,
    maximized: false,
    isActive: true,
  }

  // Deactivate all others
  windows = windows.map(w => ({ ...w, isActive: false }))
  windows = [...windows, win]
  notify()
  return win
}

export function closeWindow(id: string) {
  const wasActive = getWindow(id)?.isActive ?? false
  windows = windows.filter(w => w.id !== id)

  // If closed window was active, activate the topmost remaining window
  if (wasActive && windows.length > 0) {
    const topmost = [...windows].sort((a, b) => b.zIndex - a.zIndex)[0]
    updateWindow(topmost.id, { isActive: true })
  }

  notify()
}

export function focusWindow(id: string) {
  if (!getWindow(id)) return
  windows = windows.map(w => ({
    ...w,
    isActive: w.id === id,
    zIndex: w.id === id ? nextZIndex++ : w.zIndex,
  }))
  notify()
}

export function minimizeWindow(id: string) {
  const win = getWindow(id)
  if (!win) return
  updateWindow(id, { minimized: true, isActive: false })

  // Activate next topmost visible window
  const visible = windows
    .filter(w => w.id !== id && !w.minimized)
    .sort((a, b) => b.zIndex - a.zIndex)
  if (visible.length > 0) {
    updateWindow(visible[0].id, { isActive: true })
  }

  notify()
}

export function unminimizeWindow(id: string) {
  if (!getWindow(id)) return
  windows = windows.map(w => ({ ...w, isActive: false }))
  updateWindow(id, { minimized: false, isActive: true, zIndex: nextZIndex++ })
  notify()
}

export function maximizeWindow(id: string) {
  const win = getWindow(id)
  if (!win) return
  if (win.maximized) {
    // Restore
    updateWindow(id, { maximized: false })
  } else {
    updateWindow(id, { maximized: true })
  }
  focusWindow(id)
}

export function moveWindow(id: string, x: number, y: number) {
  if (!getWindow(id)) return
  updateWindow(id, { x, y, maximized: false })
  notify()
}

export function resizeWindow(id: string, width: number, height: number) {
  if (!getWindow(id)) return
  const clampedW = Math.max(320, width)
  const clampedH = Math.max(200, height)
  updateWindow(id, { width: clampedW, height: clampedH, maximized: false })
  notify()
}

// ── Subscription ──────────────────────────────────────────────────────────────

export function getWindows(): WindowState[] {
  return snapshot()
}

export function addListener(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
