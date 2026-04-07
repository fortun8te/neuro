# macOS Activity Tracker

Silent desktop activity recorder for building computer-use AI training datasets.

Captures mouse clicks, keyboard events, screenshots, focused app context,
window info, and accessibility element data.

## Quick Start

```bash
cd /Users/mk/Downloads/nomads/tracker
./start.sh
```

Press `Ctrl+C` to stop. The session is saved and consolidated automatically.

## Requirements

- macOS 12+
- Python 3.11 (`/opt/homebrew/bin/python3.11`)
- pyobjc (installed automatically by `start.sh`)

## macOS Permissions

Three permissions are needed. Grant them in **System Settings > Privacy & Security**:

| Permission | Required for | Add this binary |
|---|---|---|
| **Input Monitoring** | Keyboard + mouse event capture | `/opt/homebrew/bin/python3.11` or `Terminal.app` |
| **Accessibility** | UI element info under cursor | Same as above |
| **Screen Recording** | Screenshot capture | Same as above |

After adding the binary, **restart the script** (permissions only take effect on relaunch).

The tracker will warn at startup if any permission is missing but will still run with reduced functionality.

## Usage

```bash
# Default (screenshots ON, quality 80%)
./start.sh

# Lower JPEG quality (faster, smaller files)
./start.sh --quality 60

# No screenshots (events only)
./start.sh --no-screenshots

# No accessibility lookups
./start.sh --no-accessibility

# Custom session directory
./start.sh --session-dir /tmp/my_session
```

## Output Structure

```
tracker/sessions/20260405_143022_a1b2c3d4/
  raw_events.jsonl          # Raw events as captured
  events.jsonl              # Consolidated (merged keystrokes, double-clicks)
  screenshots/
    1712345678000.jpg       # JPEG per click action
    1712345678500.jpg
    ...
```

## Event Format (JSONL)

Each line in `events.jsonl` is a JSON object:

```json
{
  "session_id": "a1b2c3d4-...",
  "timestamp_ms": 1712345678000,
  "action": {
    "type": "click",
    "coordinates_abs": {"x": 648, "y": 108},
    "coordinates_norm": {"x": 0.45, "y": 0.12},
    "button": "left",
    "modifiers": []
  },
  "context": {
    "focused_app_bundle": "com.apple.Safari",
    "focused_app_name": "Safari",
    "window_title": "Google - Safari",
    "window_bounds": {"x": 0, "y": 25, "width": 1440, "height": 875},
    "screen_size": {"width": 2880, "height": 1800}
  },
  "screenshot_path": "screenshots/1712345678000.jpg",
  "element_info": {
    "role": "AXButton",
    "title": "Search"
  }
}
```

### Action Types

| Type | Description |
|---|---|
| `click` | Left mouse button down |
| `right_click` | Right mouse button down |
| `double_click` | Two rapid left clicks (detected by consolidator) |
| `type` | Merged keystroke sequence (e.g. typing a word) |
| `hotkey` | Modifier combo like `cmd+c`, `cmd+shift+s` |
| `scroll` | Scroll wheel with direction + delta |
| `session_start` | Session begin marker |
| `session_end` | Session end marker |

## Post-Processing

The consolidator runs automatically on shutdown. To re-run it manually:

```bash
/opt/homebrew/bin/python3.11 consolidator.py sessions/20260405_143022_a1b2c3d4/raw_events.jsonl
```

This produces a `_consolidated.jsonl` file with:
- Rapid keystrokes merged into `type` events with full text
- Double-clicks detected from rapid same-position clicks
- Hotkeys tagged with `cmd+c` style key strings
- Internal tracking fields removed

## Architecture

| File | Purpose |
|---|---|
| `tracker.py` | Main script: CGEvent tap, event loop, orchestration |
| `screenshot.py` | Quartz-based full-screen JPEG capture |
| `accessibility.py` | AXUIElement lookup + NSWorkspace app/window info |
| `consolidator.py` | Post-processing: merge keystrokes, detect double-clicks |
| `start.sh` | One-line launcher with dependency check |

## Performance

- CPU usage: typically under 1% (event-driven, not polling)
- Screenshots: async on background thread, JPEG quality 80 ~200-400KB each
- Disk: ~1-5MB per hour of events, screenshots dominate storage
- Memory: under 50MB resident

## Tips

- Run in a dedicated Terminal tab/window
- For long sessions, use `--quality 60` to reduce disk usage
- The tracker prints a status line every 60 seconds
- Screenshots are only captured on click events, not continuously
- Use `--no-screenshots` for pure event logging at minimal disk cost
