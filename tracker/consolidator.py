"""
Post-processing consolidator for raw tracker events.

Takes a raw JSONL file (one event per line) and produces a cleaned
JSONL with:
  - Rapid keystrokes merged into "type" actions with full text
  - Double-clicks detected from rapid same-position left clicks
  - Hotkeys (modifier + key) tagged as "hotkey" actions
  - Redundant/noise events removed
  - Chronological ordering guaranteed

Can be run standalone or imported and called programmatically.
"""

import json
import sys
import os
import logging
from typing import List, Dict, Any, Optional
from copy import deepcopy

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DOUBLE_CLICK_MAX_MS = 400  # Max ms between two clicks to count as double-click
DOUBLE_CLICK_MAX_PX = 5  # Max pixel distance between two clicks
KEYSTROKE_MERGE_MAX_MS = 1500  # Max ms gap to merge keystrokes into one "type"
MODIFIER_KEYS = frozenset(
    [
        "cmd",
        "shift",
        "alt",
        "ctrl",
        "fn",
        "command",
        "option",
        "control",
        "capslock",
    ]
)


# ---------------------------------------------------------------------------
# Double-click detection
# ---------------------------------------------------------------------------
def _detect_double_clicks(events: List[Dict]) -> List[Dict]:
    """
    Scan for consecutive left-click pairs that are close in time and
    position.  Replace the pair with a single double_click event.
    """
    if len(events) < 2:
        return events

    result: List[Dict] = []
    i = 0

    while i < len(events):
        ev = events[i]

        # Only consider left clicks
        if ev.get("action", {}).get("type") != "click" or ev.get("action", {}).get(
            "button"
        ) != "left":
            result.append(ev)
            i += 1
            continue

        # Look ahead for a matching second click
        if i + 1 < len(events):
            next_ev = events[i + 1]
            next_action = next_ev.get("action", {})

            if next_action.get("type") == "click" and next_action.get("button") == "left":
                dt = next_ev["timestamp_ms"] - ev["timestamp_ms"]
                abs_a = ev["action"].get("coordinates_abs", {})
                abs_b = next_action.get("coordinates_abs", {})
                dx = abs(abs_a.get("x", 0) - abs_b.get("x", 0))
                dy = abs(abs_a.get("y", 0) - abs_b.get("y", 0))

                if dt <= DOUBLE_CLICK_MAX_MS and dx <= DOUBLE_CLICK_MAX_PX and dy <= DOUBLE_CLICK_MAX_PX:
                    merged = deepcopy(ev)
                    merged["action"]["type"] = "double_click"
                    # Use the second event's screenshot (more representative)
                    if "screenshot_path" in next_ev:
                        merged["screenshot_path"] = next_ev["screenshot_path"]
                    result.append(merged)
                    i += 2  # Skip the second click
                    continue

        result.append(ev)
        i += 1

    return result


# ---------------------------------------------------------------------------
# Keystroke merging
# ---------------------------------------------------------------------------
def _is_plain_keystroke(ev: Dict) -> bool:
    """True if the event is a simple keystroke (not a hotkey)."""
    action = ev.get("action", {})
    return (
        action.get("type") == "keystroke"
        and not action.get("is_hotkey", False)
    )


def _merge_keystrokes(events: List[Dict]) -> List[Dict]:
    """
    Merge consecutive plain keystrokes into a single "type" action
    when they occur within KEYSTROKE_MERGE_MAX_MS of each other.
    """
    result: List[Dict] = []
    buffer: List[Dict] = []

    def flush_buffer():
        if not buffer:
            return
        if len(buffer) == 1:
            # Single keystroke -- keep as-is but rename to "type"
            ev = deepcopy(buffer[0])
            ev["action"]["type"] = "type"
            ev["action"]["text"] = ev["action"].get("key_char", "")
            result.append(ev)
        else:
            # Merge: take the first event as the base, accumulate text
            merged = deepcopy(buffer[0])
            chars = []
            for b in buffer:
                c = b.get("action", {}).get("key_char", "")
                if c:
                    chars.append(c)
            merged["action"] = {
                "type": "type",
                "text": "".join(chars),
            }
            merged["timestamp_ms_end"] = buffer[-1]["timestamp_ms"]
            # Use last screenshot if available
            for b in reversed(buffer):
                if "screenshot_path" in b:
                    merged["screenshot_path"] = b["screenshot_path"]
                    break
            result.append(merged)

    for ev in events:
        if _is_plain_keystroke(ev):
            if buffer:
                dt = ev["timestamp_ms"] - buffer[-1]["timestamp_ms"]
                if dt <= KEYSTROKE_MERGE_MAX_MS:
                    buffer.append(ev)
                    continue
                else:
                    flush_buffer()
                    buffer = [ev]
            else:
                buffer = [ev]
        else:
            flush_buffer()
            buffer = []
            result.append(ev)

    flush_buffer()
    return result


# ---------------------------------------------------------------------------
# Hotkey tagging
# ---------------------------------------------------------------------------
def _tag_hotkeys(events: List[Dict]) -> List[Dict]:
    """
    Events that already have is_hotkey=True are re-tagged
    with action.type = "hotkey" for consistency.
    """
    for ev in events:
        action = ev.get("action", {})
        if action.get("is_hotkey", False) and action.get("type") != "hotkey":
            action["type"] = "hotkey"
    return events


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
def _remove_internal_fields(events: List[Dict]) -> List[Dict]:
    """Strip internal/temporary fields used during recording."""
    internal_keys = {"is_hotkey", "key_char", "raw_keycode"}
    for ev in events:
        action = ev.get("action", {})
        for key in internal_keys:
            action.pop(key, None)
        # Remove empty optional fields
        for key in list(action.keys()):
            if action[key] is None or action[key] == "":
                del action[key]
    return events


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def consolidate(events: List[Dict]) -> List[Dict]:
    """
    Run the full consolidation pipeline on a list of event dicts.

    Args:
        events: Raw event dicts sorted by timestamp_ms.

    Returns:
        Cleaned, consolidated event list.
    """
    # Ensure sorted
    events = sorted(events, key=lambda e: e.get("timestamp_ms", 0))

    # Pipeline
    events = _tag_hotkeys(events)
    events = _detect_double_clicks(events)
    events = _merge_keystrokes(events)
    events = _remove_internal_fields(events)

    return events


def consolidate_file(
    input_path: str, output_path: Optional[str] = None
) -> str:
    """
    Read a raw JSONL file, consolidate, write cleaned JSONL.

    Args:
        input_path:  Path to raw .jsonl file.
        output_path: Path for cleaned output.  Defaults to
                     <input_stem>_consolidated.jsonl.

    Returns:
        The output file path.
    """
    if output_path is None:
        stem, ext = os.path.splitext(input_path)
        output_path = f"{stem}_consolidated{ext}"

    raw_events: List[Dict] = []
    with open(input_path, "r") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                raw_events.append(json.loads(line))
            except json.JSONDecodeError as e:
                logger.warning("Skipping malformed line %d: %s", line_no, e)

    logger.info("Read %d raw events from %s", len(raw_events), input_path)

    cleaned = consolidate(raw_events)

    with open(output_path, "w") as f:
        for ev in cleaned:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")

    logger.info(
        "Wrote %d consolidated events to %s", len(cleaned), output_path
    )
    return output_path


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    if len(sys.argv) < 2:
        print("Usage: python consolidator.py <input.jsonl> [output.jsonl]")
        sys.exit(1)

    inp = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else None
    result = consolidate_file(inp, out)
    print(f"Done: {result}")
