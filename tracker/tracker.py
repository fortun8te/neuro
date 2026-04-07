#!/usr/bin/env python3
"""
macOS Activity Tracker for Computer-Use AI Training Data

Silently records mouse clicks, keyboard events, screenshots, focused app,
window info, and accessibility element data.  Outputs JSONL + JPEG screenshots
organized per session.

Requirements:
  - macOS 12+
  - Python 3.11
  - pyobjc-core, pyobjc-framework-Cocoa, pyobjc-framework-Quartz,
    pyobjc-framework-ApplicationServices, Pillow
  - Accessibility permission for this process
  - Screen Recording permission for this process

Usage:
    python3.11 tracker.py [--session-dir DIR] [--quality 80] [--no-screenshots]
"""

import argparse
import json
import logging
import os
import signal
import sys
import threading
import time
import uuid
from collections import deque
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# macOS frameworks
# ---------------------------------------------------------------------------
import Quartz
from Quartz import (
    CGEventGetLocation,
    CGEventGetIntegerValueField,
    CGEventGetFlags,
    CGEventGetTimestamp,
    CGEventGetType,
    kCGEventLeftMouseDown,
    kCGEventLeftMouseUp,
    kCGEventRightMouseDown,
    kCGEventRightMouseUp,
    kCGEventOtherMouseDown,
    kCGEventOtherMouseUp,
    kCGEventMouseMoved,
    kCGEventKeyDown,
    kCGEventKeyUp,
    kCGEventScrollWheel,
    kCGEventFlagsChanged,
    kCGScrollWheelEventDeltaAxis1,
    kCGScrollWheelEventDeltaAxis2,
    kCGKeyboardEventKeycode,
    kCGEventFlagMaskShift,
    kCGEventFlagMaskControl,
    kCGEventFlagMaskAlternate,
    kCGEventFlagMaskCommand,
    CGEventTapCreate,
    CGEventTapEnable,
    kCGSessionEventTap,
    kCGHeadInsertEventTap,
    kCGEventTapOptionListenOnly,
    CGEventMaskBit,
)
from Quartz import (
    CGPreflightListenEventAccess,
    CGRequestListenEventAccess,
)
from CoreFoundation import (
    CFMachPortCreateRunLoopSource,
    CFRunLoopGetCurrent,
    CFRunLoopAddSource,
    CFRunLoopRun,
    CFRunLoopStop,
    kCFRunLoopDefaultMode,
)

# ---------------------------------------------------------------------------
# Local modules
# ---------------------------------------------------------------------------
from screenshot import (
    capture_screenshot,
    get_screen_size,
    check_screen_recording_permission,
)
from accessibility import (
    get_element_at_position,
    get_focused_app_info,
    get_focused_window_info,
    check_accessibility_permission,
)
from consolidator import consolidate

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("tracker")

# ---------------------------------------------------------------------------
# macOS keycode -> character map  (US QWERTY, covers the common keys)
# ---------------------------------------------------------------------------
KEYCODE_MAP = {
    0: "a", 1: "s", 2: "d", 3: "f", 4: "h", 5: "g", 6: "z", 7: "x",
    8: "c", 9: "v", 11: "b", 12: "q", 13: "w", 14: "e", 15: "r",
    16: "y", 17: "t", 18: "1", 19: "2", 20: "3", 21: "4", 22: "6",
    23: "5", 24: "=", 25: "9", 26: "7", 27: "-", 28: "8", 29: "0",
    30: "]", 31: "o", 32: "u", 33: "[", 34: "i", 35: "p", 36: "return",
    37: "l", 38: "j", 39: "'", 40: "k", 41: ";", 42: "\\", 43: ",",
    44: "/", 45: "n", 46: "m", 47: ".", 48: "tab", 49: "space",
    50: "`", 51: "backspace", 53: "escape",
    # Arrow keys
    123: "left", 124: "right", 125: "down", 126: "up",
    # Function keys
    122: "f1", 120: "f2", 99: "f3", 118: "f4", 96: "f5", 97: "f6",
    98: "f7", 100: "f8", 101: "f9", 109: "f10", 103: "f11", 111: "f12",
    # Modifiers (keycodes for flag-changed events)
    55: "cmd", 56: "shift", 58: "alt", 59: "ctrl",
    54: "cmd_right", 60: "shift_right", 61: "alt_right", 62: "ctrl_right",
    63: "fn",
}


def _flags_to_modifiers(flags: int) -> List[str]:
    """Convert CGEvent flags bitmask to a list of modifier names."""
    mods = []
    if flags & kCGEventFlagMaskCommand:
        mods.append("cmd")
    if flags & kCGEventFlagMaskShift:
        mods.append("shift")
    if flags & kCGEventFlagMaskAlternate:
        mods.append("alt")
    if flags & kCGEventFlagMaskControl:
        mods.append("ctrl")
    return mods


def _keycode_to_char(keycode: int, flags: int) -> str:
    """Best-effort keycode to character string."""
    return KEYCODE_MAP.get(keycode, f"<{keycode}>")


# ---------------------------------------------------------------------------
# Tracker class
# ---------------------------------------------------------------------------
class ActivityTracker:
    """Global macOS desktop activity tracker."""

    def __init__(
        self,
        session_dir: str,
        screenshot_quality: float = 0.80,
        enable_screenshots: bool = True,
        enable_accessibility: bool = True,
    ):
        self.session_id = str(uuid.uuid4())
        self.session_dir = session_dir
        self.screenshots_dir = os.path.join(session_dir, "screenshots")
        self.raw_jsonl_path = os.path.join(session_dir, "raw_events.jsonl")
        self.consolidated_jsonl_path = os.path.join(session_dir, "events.jsonl")
        self.screenshot_quality = screenshot_quality
        self.enable_screenshots = enable_screenshots
        self.enable_accessibility = enable_accessibility

        # State
        self._event_count = 0
        self._running = False
        self._jsonl_file = None
        self._jsonl_lock = threading.Lock()
        self._screenshot_queue: deque = deque(maxlen=100)
        self._screenshot_thread: Optional[threading.Thread] = None
        self._last_status_time = time.time()
        self._start_time = time.time()

        # Screen size (cached, updated on first event)
        self._screen_w, self._screen_h = 0, 0

        # For double-click detection at write time (not used in raw events,
        # but we record raw clicks -- consolidator handles merging)
        self._run_loop_ref = None

        os.makedirs(self.screenshots_dir, exist_ok=True)

        logger.info("Session ID : %s", self.session_id)
        logger.info("Session dir: %s", self.session_dir)

    # ------------------------------------------------------------------
    # Coordinate normalization
    # ------------------------------------------------------------------
    def _update_screen_size(self):
        self._screen_w, self._screen_h = get_screen_size()

    def _normalize_coords(self, x: float, y: float) -> Dict[str, float]:
        if self._screen_w == 0 or self._screen_h == 0:
            self._update_screen_size()
        if self._screen_w > 0 and self._screen_h > 0:
            return {
                "x": round(x / self._screen_w, 5),
                "y": round(y / self._screen_h, 5),
            }
        return {"x": 0.0, "y": 0.0}

    # ------------------------------------------------------------------
    # Context gathering
    # ------------------------------------------------------------------
    def _get_context(self) -> Dict[str, Any]:
        ctx: Dict[str, Any] = {}

        app_info = get_focused_app_info()
        if app_info:
            ctx["focused_app_bundle"] = app_info.get("bundle_id", "")
            ctx["focused_app_name"] = app_info.get("name", "")
        else:
            ctx["focused_app_bundle"] = ""
            ctx["focused_app_name"] = ""

        win_info = get_focused_window_info()
        if win_info:
            ctx["window_title"] = win_info.get("title", "")
            ctx["window_bounds"] = win_info.get("bounds", {})
        else:
            ctx["window_title"] = ""
            ctx["window_bounds"] = {}

        if self._screen_w == 0:
            self._update_screen_size()
        ctx["screen_size"] = {
            "width": self._screen_w,
            "height": self._screen_h,
        }

        return ctx

    # ------------------------------------------------------------------
    # Screenshot handling (async, off main thread)
    # ------------------------------------------------------------------
    def _screenshot_worker(self):
        """Background thread that processes screenshot requests."""
        while self._running:
            try:
                if self._screenshot_queue:
                    ts_ms, output_path = self._screenshot_queue.popleft()
                    capture_screenshot(output_path, self.screenshot_quality)
                else:
                    time.sleep(0.01)
            except IndexError:
                time.sleep(0.01)
            except Exception as e:
                logger.debug("Screenshot worker error: %s", e)

    def _enqueue_screenshot(self, timestamp_ms: int) -> str:
        """Queue a screenshot capture and return the expected path."""
        filename = f"{timestamp_ms}.jpg"
        rel_path = f"screenshots/{filename}"
        abs_path = os.path.join(self.screenshots_dir, filename)
        self._screenshot_queue.append((timestamp_ms, abs_path))
        return rel_path

    # ------------------------------------------------------------------
    # Event writing
    # ------------------------------------------------------------------
    def _write_event(self, event: Dict[str, Any]):
        """Thread-safe write of a single event to the JSONL file."""
        with self._jsonl_lock:
            if self._jsonl_file and not self._jsonl_file.closed:
                self._jsonl_file.write(
                    json.dumps(event, ensure_ascii=False) + "\n"
                )
                self._jsonl_file.flush()
                self._event_count += 1

        # Status line every 60 seconds
        now = time.time()
        if now - self._last_status_time >= 60:
            elapsed = int(now - self._start_time)
            logger.info(
                "Status: %d events recorded | elapsed %ds | session %s",
                self._event_count,
                elapsed,
                self.session_id[:8],
            )
            self._last_status_time = now

    # ------------------------------------------------------------------
    # Event builders
    # ------------------------------------------------------------------
    def _build_click_event(
        self,
        x: float,
        y: float,
        button: str,
        timestamp_ms: int,
        modifiers: List[str],
    ) -> Dict[str, Any]:
        event: Dict[str, Any] = {
            "session_id": self.session_id,
            "timestamp_ms": timestamp_ms,
            "action": {
                "type": "click",
                "coordinates_abs": {"x": int(x), "y": int(y)},
                "coordinates_norm": self._normalize_coords(x, y),
                "button": button,
                "modifiers": modifiers if modifiers else [],
            },
            "context": self._get_context(),
        }

        # Screenshot
        if self.enable_screenshots:
            event["screenshot_path"] = self._enqueue_screenshot(timestamp_ms)

        # Accessibility element
        if self.enable_accessibility:
            elem = get_element_at_position(x, y)
            if elem:
                event["element_info"] = elem

        return event

    def _build_key_event(
        self,
        keycode: int,
        flags: int,
        timestamp_ms: int,
    ) -> Optional[Dict[str, Any]]:
        modifiers = _flags_to_modifiers(flags)
        key_char = _keycode_to_char(keycode, flags)

        # Detect hotkey: a non-modifier key pressed while cmd/ctrl is held
        is_hotkey = bool(
            modifiers
            and key_char not in ("cmd", "shift", "alt", "ctrl", "fn",
                                  "cmd_right", "shift_right", "alt_right", "ctrl_right")
            and ("cmd" in modifiers or "ctrl" in modifiers)
        )

        action: Dict[str, Any] = {
            "type": "hotkey" if is_hotkey else "keystroke",
            "key_char": key_char,
            "raw_keycode": keycode,
            "modifiers": modifiers,
            "is_hotkey": is_hotkey,
        }

        if is_hotkey:
            parts = modifiers + [key_char]
            action["keys"] = "+".join(parts)

        event: Dict[str, Any] = {
            "session_id": self.session_id,
            "timestamp_ms": timestamp_ms,
            "action": action,
            "context": self._get_context(),
        }

        return event

    def _build_scroll_event(
        self,
        x: float,
        y: float,
        delta_y: int,
        delta_x: int,
        timestamp_ms: int,
        modifiers: List[str],
    ) -> Dict[str, Any]:
        if abs(delta_y) >= abs(delta_x):
            direction = "down" if delta_y < 0 else "up"
        else:
            direction = "right" if delta_x < 0 else "left"

        return {
            "session_id": self.session_id,
            "timestamp_ms": timestamp_ms,
            "action": {
                "type": "scroll",
                "coordinates_abs": {"x": int(x), "y": int(y)},
                "coordinates_norm": self._normalize_coords(x, y),
                "scroll_direction": direction,
                "delta_y": delta_y,
                "delta_x": delta_x,
                "modifiers": modifiers if modifiers else [],
            },
            "context": self._get_context(),
        }

    # ------------------------------------------------------------------
    # CGEvent callback
    # ------------------------------------------------------------------
    def _event_callback(self, proxy, event_type, event, refcon):
        """
        Called by the CGEvent tap for every matching event.
        Must return quickly to avoid lagging the system.
        """
        try:
            # Timestamp: CGEvent timestamp is in mach_absolute_time units.
            # We use wall-clock time for simplicity and cross-platform compat.
            timestamp_ms = int(time.time() * 1000)

            loc = CGEventGetLocation(event)
            x, y = loc.x, loc.y
            flags = CGEventGetFlags(event)
            modifiers = _flags_to_modifiers(flags)

            # --- Mouse clicks ---
            if event_type in (kCGEventLeftMouseDown,):
                ev = self._build_click_event(x, y, "left", timestamp_ms, modifiers)
                self._write_event(ev)

            elif event_type in (kCGEventRightMouseDown,):
                ev = self._build_click_event(x, y, "right", timestamp_ms, modifiers)
                ev["action"]["type"] = "right_click"
                self._write_event(ev)

            elif event_type in (kCGEventOtherMouseDown,):
                ev = self._build_click_event(x, y, "middle", timestamp_ms, modifiers)
                ev["action"]["type"] = "click"
                ev["action"]["button"] = "middle"
                self._write_event(ev)

            # --- Keyboard ---
            elif event_type == kCGEventKeyDown:
                keycode = CGEventGetIntegerValueField(
                    event, kCGKeyboardEventKeycode
                )
                ev = self._build_key_event(keycode, flags, timestamp_ms)
                if ev:
                    self._write_event(ev)

            # --- Scroll wheel ---
            elif event_type == kCGEventScrollWheel:
                delta_y = CGEventGetIntegerValueField(
                    event, kCGScrollWheelEventDeltaAxis1
                )
                delta_x = CGEventGetIntegerValueField(
                    event, kCGScrollWheelEventDeltaAxis2
                )
                # Ignore tiny/zero scrolls
                if delta_y != 0 or delta_x != 0:
                    ev = self._build_scroll_event(
                        x, y, delta_y, delta_x, timestamp_ms, modifiers
                    )
                    self._write_event(ev)

        except Exception as e:
            logger.debug("Event callback error: %s", e)

        # Return None to pass the event through (listen-only tap)
        return event

    # ------------------------------------------------------------------
    # Permission checks
    # ------------------------------------------------------------------
    def check_permissions(self) -> bool:
        """Check required macOS permissions and print guidance."""
        ok = True

        # Event tap permission (Accessibility or Input Monitoring)
        if not CGPreflightListenEventAccess():
            logger.warning(
                "Input Monitoring permission not granted.\n"
                "  Go to: System Settings > Privacy & Security > Input Monitoring\n"
                "  Add: /opt/homebrew/bin/python3.11 (or Terminal.app)\n"
                "  Then restart this script."
            )
            # Try requesting (will show the system prompt)
            CGRequestListenEventAccess()
            ok = False

        # Accessibility
        if self.enable_accessibility:
            if not check_accessibility_permission():
                logger.warning(
                    "Accessibility permission not granted.\n"
                    "  Go to: System Settings > Privacy & Security > Accessibility\n"
                    "  Add: /opt/homebrew/bin/python3.11 (or Terminal.app)\n"
                    "  Accessibility element info will be empty until granted."
                )
                # Non-fatal: we continue without AX info

        # Screen Recording
        if self.enable_screenshots:
            if not check_screen_recording_permission():
                logger.warning(
                    "Screen Recording permission not granted.\n"
                    "  Go to: System Settings > Privacy & Security > Screen Recording\n"
                    "  Add: /opt/homebrew/bin/python3.11 (or Terminal.app)\n"
                    "  Screenshots will be blank/None until granted."
                )
                # Non-fatal: we continue but screenshots may be empty

        return ok

    # ------------------------------------------------------------------
    # Start / Stop
    # ------------------------------------------------------------------
    def start(self):
        """Start recording events.  Blocks on CFRunLoopRun."""
        self._running = True
        self._start_time = time.time()
        self._last_status_time = time.time()

        # Open JSONL file
        self._jsonl_file = open(self.raw_jsonl_path, "a", encoding="utf-8")

        # Write session header
        header = {
            "session_id": self.session_id,
            "timestamp_ms": int(time.time() * 1000),
            "action": {"type": "session_start"},
            "context": self._get_context(),
            "meta": {
                "screen_size": {
                    "width": self._screen_w,
                    "height": self._screen_h,
                },
                "session_dir": self.session_dir,
            },
        }
        self._write_event(header)

        # Start screenshot worker
        if self.enable_screenshots:
            self._screenshot_thread = threading.Thread(
                target=self._screenshot_worker, daemon=True
            )
            self._screenshot_thread.start()

        # Build event mask
        event_mask = (
            CGEventMaskBit(kCGEventLeftMouseDown)
            | CGEventMaskBit(kCGEventRightMouseDown)
            | CGEventMaskBit(kCGEventOtherMouseDown)
            | CGEventMaskBit(kCGEventKeyDown)
            | CGEventMaskBit(kCGEventScrollWheel)
        )

        # Create the event tap
        tap = CGEventTapCreate(
            kCGSessionEventTap,
            kCGHeadInsertEventTap,
            kCGEventTapOptionListenOnly,  # Passive -- does not block events
            event_mask,
            self._event_callback,
            None,
        )

        if tap is None:
            logger.error(
                "Failed to create CGEvent tap. "
                "Check Input Monitoring / Accessibility permissions."
            )
            self.stop()
            sys.exit(1)

        # Wire tap into the run loop
        source = CFMachPortCreateRunLoopSource(None, tap, 0)
        loop = CFRunLoopGetCurrent()
        self._run_loop_ref = loop
        CFRunLoopAddSource(loop, source, kCFRunLoopDefaultMode)
        CGEventTapEnable(tap, True)

        logger.info("Tracker running -- press Ctrl+C to stop")
        logger.info(
            "Screenshots: %s | Accessibility: %s",
            "ON" if self.enable_screenshots else "OFF",
            "ON" if self.enable_accessibility else "OFF",
        )

        # Block on the run loop
        try:
            CFRunLoopRun()
        except KeyboardInterrupt:
            pass

        self.stop()

    def stop(self):
        """Graceful shutdown: flush data, consolidate, close files."""
        if not self._running:
            return
        self._running = False

        logger.info("Shutting down...")

        # Stop the CFRunLoop
        if self._run_loop_ref:
            CFRunLoopStop(self._run_loop_ref)
            self._run_loop_ref = None

        # Wait for screenshot queue to drain (up to 5s)
        if self._screenshot_thread and self._screenshot_thread.is_alive():
            deadline = time.time() + 5
            while self._screenshot_queue and time.time() < deadline:
                time.sleep(0.1)

        # Write session footer
        footer = {
            "session_id": self.session_id,
            "timestamp_ms": int(time.time() * 1000),
            "action": {"type": "session_end"},
            "context": {},
            "meta": {
                "total_events": self._event_count,
                "duration_seconds": int(time.time() - self._start_time),
            },
        }
        self._write_event(footer)

        # Close JSONL
        with self._jsonl_lock:
            if self._jsonl_file and not self._jsonl_file.closed:
                self._jsonl_file.close()
                self._jsonl_file = None

        # Run consolidation
        logger.info("Consolidating %d raw events...", self._event_count)
        try:
            raw_events = []
            with open(self.raw_jsonl_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        raw_events.append(json.loads(line))

            cleaned = consolidate(raw_events)

            with open(self.consolidated_jsonl_path, "w") as f:
                for ev in cleaned:
                    f.write(json.dumps(ev, ensure_ascii=False) + "\n")

            logger.info(
                "Consolidated: %d -> %d events -> %s",
                len(raw_events),
                len(cleaned),
                self.consolidated_jsonl_path,
            )
        except Exception as e:
            logger.error("Consolidation failed: %s", e)

        # Count screenshots
        try:
            num_screenshots = len(os.listdir(self.screenshots_dir))
        except Exception:
            num_screenshots = 0

        elapsed = int(time.time() - self._start_time)
        logger.info(
            "Session complete: %d events, %d screenshots, %ds elapsed",
            self._event_count,
            num_screenshots,
            elapsed,
        )
        logger.info("Output: %s", self.session_dir)


# ---------------------------------------------------------------------------
# Signal handling
# ---------------------------------------------------------------------------
_tracker_instance: Optional[ActivityTracker] = None


def _signal_handler(signum, frame):
    global _tracker_instance
    if _tracker_instance:
        _tracker_instance.stop()
    sys.exit(0)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    global _tracker_instance

    parser = argparse.ArgumentParser(
        description="macOS Activity Tracker for AI training data"
    )
    parser.add_argument(
        "--session-dir",
        type=str,
        default=None,
        help="Directory for this session. Auto-generated if omitted.",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=80,
        help="JPEG screenshot quality 1-100 (default: 80)",
    )
    parser.add_argument(
        "--no-screenshots",
        action="store_true",
        help="Disable screenshot capture",
    )
    parser.add_argument(
        "--no-accessibility",
        action="store_true",
        help="Disable accessibility element lookup",
    )
    args = parser.parse_args()

    # Session directory
    if args.session_dir:
        session_dir = args.session_dir
    else:
        base_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "sessions"
        )
        session_id = str(uuid.uuid4())[:8]
        ts = time.strftime("%Y%m%d_%H%M%S")
        session_dir = os.path.join(base_dir, f"{ts}_{session_id}")

    os.makedirs(session_dir, exist_ok=True)

    tracker = ActivityTracker(
        session_dir=session_dir,
        screenshot_quality=args.quality / 100.0,
        enable_screenshots=not args.no_screenshots,
        enable_accessibility=not args.no_accessibility,
    )
    _tracker_instance = tracker

    # Register signal handlers
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    # Check permissions
    tracker.check_permissions()

    # Update screen size
    tracker._update_screen_size()
    logger.info(
        "Screen: %dx%d", tracker._screen_w, tracker._screen_h
    )

    # Start (blocks)
    tracker.start()


if __name__ == "__main__":
    main()
