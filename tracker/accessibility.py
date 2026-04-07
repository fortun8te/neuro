"""
Accessibility module -- queries AXUIElement information at a given screen
coordinate.  Best-effort: returns None fields if the Accessibility API is
unavailable or the element cannot be resolved.

Requires: System Preferences > Privacy & Security > Accessibility permission
for the Python interpreter or Terminal app running this script.
"""

import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Guard the import so the rest of the tracker still works even if
# ApplicationServices is unavailable.
try:
    from ApplicationServices import (
        AXUIElementCreateSystemWide,
        AXUIElementCopyElementAtPosition,
        AXUIElementCopyAttributeValue,
        AXIsProcessTrusted,
    )
    from ApplicationServices import (
        kAXRoleAttribute,
        kAXTitleAttribute,
        kAXDescriptionAttribute,
        kAXRoleDescriptionAttribute,
        kAXValueAttribute,
        kAXIdentifierAttribute,
    )

    _AX_AVAILABLE = True
except ImportError:
    _AX_AVAILABLE = False
    logger.warning(
        "ApplicationServices not available -- accessibility info will be empty"
    )


def check_accessibility_permission() -> bool:
    """Return True if this process has Accessibility permission."""
    if not _AX_AVAILABLE:
        return False
    try:
        return bool(AXIsProcessTrusted())
    except Exception:
        return False


def _get_ax_attribute(element, attribute: str) -> Optional[str]:
    """Safely read a single AX attribute from an element."""
    try:
        err, value = AXUIElementCopyAttributeValue(element, attribute, None)
        if err == 0 and value is not None:
            return str(value)
    except Exception:
        pass
    return None


def get_element_at_position(x: float, y: float) -> Optional[Dict[str, Any]]:
    """
    Query the Accessibility API for the UI element at screen coordinate (x, y).

    Args:
        x: Absolute x pixel coordinate.
        y: Absolute y pixel coordinate.

    Returns:
        A dict with role, title, description, value, role_description,
        identifier -- or None if the lookup fails entirely.
    """
    if not _AX_AVAILABLE:
        return None

    try:
        system_wide = AXUIElementCreateSystemWide()
        err, element = AXUIElementCopyElementAtPosition(
            system_wide, float(x), float(y), None
        )

        if err != 0 or element is None:
            return None

        info: Dict[str, Any] = {}

        info["role"] = _get_ax_attribute(element, kAXRoleAttribute)
        info["title"] = _get_ax_attribute(element, kAXTitleAttribute)
        info["description"] = _get_ax_attribute(element, kAXDescriptionAttribute)
        info["role_description"] = _get_ax_attribute(
            element, kAXRoleDescriptionAttribute
        )
        info["value"] = _get_ax_attribute(element, kAXValueAttribute)
        info["identifier"] = _get_ax_attribute(element, kAXIdentifierAttribute)

        # Strip None values to keep output compact
        info = {k: v for k, v in info.items() if v is not None}

        return info if info else None

    except Exception as e:
        logger.debug("AX element lookup failed at (%s, %s): %s", x, y, e)
        return None


def get_focused_app_info() -> Optional[Dict[str, str]]:
    """
    Return bundle ID and localized name of the frontmost application
    using NSWorkspace (more reliable than AX for this purpose).
    """
    try:
        from AppKit import NSWorkspace

        workspace = NSWorkspace.sharedWorkspace()
        app = workspace.frontmostApplication()
        if app is None:
            return None

        return {
            "bundle_id": app.bundleIdentifier() or "",
            "name": app.localizedName() or "",
            "pid": app.processIdentifier(),
        }
    except Exception as e:
        logger.debug("Failed to get focused app info: %s", e)
        return None


def get_focused_window_info() -> Optional[Dict[str, Any]]:
    """
    Return the title and bounds of the frontmost window.
    Uses Quartz window list APIs because AXUIElement window queries
    are unreliable across different apps.
    """
    try:
        import Quartz

        # Get the window list ordered front-to-back
        window_list = Quartz.CGWindowListCopyWindowInfo(
            Quartz.kCGWindowListOptionOnScreenOnly
            | Quartz.kCGWindowListExcludeDesktopElements,
            Quartz.kCGNullWindowID,
        )

        if not window_list:
            return None

        # Find the focused app so we can match its window
        app_info = get_focused_app_info()
        if not app_info:
            return None

        target_pid = app_info.get("pid")

        for window in window_list:
            owner_pid = window.get("kCGWindowOwnerPID", -1)
            # Skip windows not belonging to the focused app
            if owner_pid != target_pid:
                continue

            # Skip tiny utility windows (menu bar items, etc.)
            bounds = window.get("kCGWindowBounds", {})
            w = bounds.get("Width", 0)
            h = bounds.get("Height", 0)
            if w < 50 or h < 50:
                continue

            window_name = window.get("kCGWindowName", "")
            layer = window.get("kCGWindowLayer", 0)

            # Only consider normal windows (layer 0)
            if layer != 0:
                continue

            return {
                "title": window_name or "",
                "bounds": {
                    "x": int(bounds.get("X", 0)),
                    "y": int(bounds.get("Y", 0)),
                    "width": int(w),
                    "height": int(h),
                },
            }

        return None

    except Exception as e:
        logger.debug("Failed to get focused window info: %s", e)
        return None
