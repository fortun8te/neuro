#!/opt/homebrew/bin/python3.11
"""
macOS Permission Checker for Mac Bridge Server

Checks all permissions required by the bridge server and guides the user
to grant any that are missing. Run this before starting bridge_server.py.

Required permissions:
  - Screen Recording   (CGDisplayCreateImage / CGWindowListCreateImage)
  - Accessibility      (CGEventPost, AXUIElement queries)
  - Input Monitoring   (global CGEvent tap, reading key events system-wide)
  - Automation         (NSAppleScript, controlling other apps via AppleScript)
"""

import subprocess
import sys


# ---------------------------------------------------------------------------
# Low-level permission checks via pyobjc / Quartz
# ---------------------------------------------------------------------------

def check_screen_recording() -> bool:
    """
    Returns True if Screen Recording permission is granted.
    Uses CGWindowListCreateImage — if it returns None the permission is absent.
    """
    try:
        import Quartz
        # CGWindowListCreateImage with an infinite rect; returns None without permission.
        image = Quartz.CGWindowListCreateImage(
            Quartz.CGRectInfinite,
            Quartz.kCGWindowListOptionOnScreenOnly,
            Quartz.kCGNullWindowID,
            Quartz.kCGWindowImageDefault,
        )
        return image is not None
    except Exception:
        return False


def check_accessibility() -> bool:
    """
    Returns True if Accessibility permission is granted.
    Uses AXIsProcessTrusted (does NOT trigger the macOS prompt).
    """
    try:
        from ApplicationServices import AXIsProcessTrusted
        return bool(AXIsProcessTrusted())
    except Exception:
        # Fall back to Quartz path
        try:
            import Quartz
            return bool(Quartz.AXIsProcessTrusted())
        except Exception:
            return False


def check_input_monitoring() -> bool:
    """
    Returns True if Input Monitoring permission is granted.
    Uses CGPreflightListenEventAccess (does NOT trigger the prompt).
    """
    try:
        from Quartz import CGPreflightListenEventAccess
        return bool(CGPreflightListenEventAccess())
    except Exception:
        return False


def check_automation() -> bool:
    """
    Returns True if Automation permission is available.
    Runs a harmless AppleScript against the Finder to test the permission.
    This may trigger the OS prompt on first run.
    """
    try:
        result = subprocess.run(
            ["osascript", "-e", 'tell application "Finder" to get name'],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False


# ---------------------------------------------------------------------------
# System Preferences / Settings openers
# ---------------------------------------------------------------------------

PREF_PATHS = {
    "screen_recording": "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
    "accessibility":    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
    "input_monitoring": "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent",
    "automation":       "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation",
}


def open_system_settings(pref_key: str):
    url = PREF_PATHS.get(pref_key)
    if url:
        subprocess.run(["open", url], check=False)


# ---------------------------------------------------------------------------
# Human-readable guidance
# ---------------------------------------------------------------------------

GUIDANCE = {
    "screen_recording": {
        "name": "Screen Recording",
        "why": "Required so the bridge can capture screenshots (CGDisplayCreateImage).",
        "path": "System Settings > Privacy & Security > Screen Recording",
        "action": "Add your terminal app or python3.11 and toggle it ON.",
    },
    "accessibility": {
        "name": "Accessibility",
        "why": "Required so the bridge can post synthetic mouse/keyboard events (CGEventPost) "
               "and query UI elements via the Accessibility API.",
        "path": "System Settings > Privacy & Security > Accessibility",
        "action": "Add your terminal app or python3.11 and toggle it ON.",
    },
    "input_monitoring": {
        "name": "Input Monitoring",
        "why": "Required for global CGEvent taps that read key and mouse events system-wide.",
        "path": "System Settings > Privacy & Security > Input Monitoring",
        "action": "Add your terminal app or python3.11 and toggle it ON.",
    },
    "automation": {
        "name": "Automation",
        "why": "Required to send AppleScript commands that control other applications.",
        "path": "System Settings > Privacy & Security > Automation",
        "action": "Enable automation access for your terminal app.",
    },
}

BINARY = "/opt/homebrew/bin/python3.11"


# ---------------------------------------------------------------------------
# Main checker
# ---------------------------------------------------------------------------

def print_banner():
    print()
    print("=" * 60)
    print("  Mac Bridge — Permission Checker")
    print("=" * 60)
    print()


def check_all(interactive: bool = True) -> dict:
    """
    Run all permission checks. Returns a dict of {key: bool}.
    When interactive=True, prints guidance and offers to open System Settings.
    """
    checks = {
        "screen_recording": check_screen_recording,
        "accessibility":    check_accessibility,
        "input_monitoring": check_input_monitoring,
        "automation":       check_automation,
    }

    results = {}
    all_ok = True

    for key, fn in checks.items():
        info = GUIDANCE[key]
        granted = fn()
        results[key] = granted
        status = "GRANTED" if granted else "MISSING"
        marker = "  " if granted else "X "

        print(f"  [{marker}] {info['name']}: {status}")

        if not granted:
            all_ok = False
            if interactive:
                print()
                print(f"       WHY:    {info['why']}")
                print(f"       PATH:   {info['path']}")
                print(f"       ACTION: {info['action']}")
                print(f"       BINARY: Add  {BINARY}")
                print()

                answer = input(f"       Open System Settings for {info['name']} now? [y/N] ").strip().lower()
                if answer == "y":
                    open_system_settings(key)
                    print(f"       Opened System Settings. Grant access, then re-run this script.")
                print()

    print()
    if all_ok:
        print("  All permissions granted. Bridge server is ready to start.")
    else:
        missing = [GUIDANCE[k]["name"] for k, v in results.items() if not v]
        print(f"  Missing permissions: {', '.join(missing)}")
        print()
        print("  After granting permissions, you may need to:")
        print("    1. Quit and reopen your terminal application.")
        print("    2. Re-run this script to verify.")
        print()
        print("  IMPORTANT: Add the exact binary that runs the server:")
        print(f"    {BINARY}")
        print("  Or add 'Terminal.app' / 'iTerm2.app' if that is how you launch it.")

    print()
    return results


def main():
    print_banner()

    # Quick non-interactive mode when called from start.sh
    interactive = "--non-interactive" not in sys.argv

    results = check_all(interactive=interactive)

    all_ok = all(results.values())

    if not all_ok and "--non-interactive" in sys.argv:
        # Exit with error so start.sh can abort
        sys.exit(1)

    return results


if __name__ == "__main__":
    main()
