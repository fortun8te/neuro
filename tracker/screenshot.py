"""
Screenshot capture module using Quartz (CoreGraphics).
Captures full-screen screenshots as JPEG with configurable quality.
"""

import os
import time
import logging
from typing import Optional, Tuple

import Quartz
from Quartz import (
    CGWindowListCreateImage,
    CGRectInfinite,
    kCGWindowListOptionOnScreenOnly,
    kCGNullWindowID,
    CGImageGetWidth,
    CGImageGetHeight,
    CGMainDisplayID,
    CGDisplayPixelsWide,
    CGDisplayPixelsHigh,
    CGDisplayBounds,
)
from CoreFoundation import CFURLCreateWithFileSystemPath, kCFAllocatorDefault

logger = logging.getLogger(__name__)


def get_screen_size() -> Tuple[int, int]:
    """Return (width, height) of the main display in pixels."""
    display_id = CGMainDisplayID()
    width = CGDisplayPixelsWide(display_id)
    height = CGDisplayPixelsHigh(display_id)
    return (width, height)


def get_display_bounds() -> dict:
    """Return the bounds of the main display."""
    display_id = CGMainDisplayID()
    bounds = CGDisplayBounds(display_id)
    return {
        "x": int(bounds.origin.x),
        "y": int(bounds.origin.y),
        "width": int(bounds.size.width),
        "height": int(bounds.size.height),
    }


def capture_screenshot(
    output_path: str,
    quality: float = 0.80,
) -> Optional[str]:
    """
    Capture a full-screen screenshot and save as JPEG.

    Args:
        output_path: Full file path for the output JPEG.
        quality: JPEG compression quality 0.0-1.0 (default 0.80).

    Returns:
        The output_path on success, None on failure.
    """
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Capture the entire screen
        image_ref = CGWindowListCreateImage(
            CGRectInfinite,
            kCGWindowListOptionOnScreenOnly,
            kCGNullWindowID,
            0,  # kCGWindowImageDefault
        )

        if image_ref is None:
            logger.error(
                "CGWindowListCreateImage returned None -- "
                "is Screen Recording permission granted?"
            )
            return None

        # Create a bitmap representation and save as JPEG
        from AppKit import (
            NSBitmapImageRep,
            NSJPEGFileType,
            NSImageCompressionFactor,
        )

        bitmap_rep = NSBitmapImageRep.alloc().initWithCGImage_(image_ref)
        jpeg_data = bitmap_rep.representationUsingType_properties_(
            NSJPEGFileType, {NSImageCompressionFactor: quality}
        )

        if jpeg_data is None:
            logger.error("Failed to convert screenshot to JPEG data")
            return None

        jpeg_data.writeToFile_atomically_(output_path, True)
        return output_path

    except Exception as e:
        logger.error("Screenshot capture failed: %s", e, exc_info=True)
        return None


def capture_screenshot_fast(
    output_path: str,
    quality: float = 0.80,
) -> Optional[str]:
    """
    Alternative fast capture using CGImage -> JPEG destination.
    Falls back to the AppKit path if this fails.
    """
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        image_ref = CGWindowListCreateImage(
            CGRectInfinite,
            kCGWindowListOptionOnScreenOnly,
            kCGNullWindowID,
            0,
        )
        if image_ref is None:
            logger.warning("Fast capture: CGWindowListCreateImage returned None")
            return None

        from Quartz import (
            CGImageDestinationCreateWithURL,
            CGImageDestinationAddImage,
            CGImageDestinationFinalize,
        )

        url = CFURLCreateWithFileSystemPath(
            kCFAllocatorDefault,
            output_path,
            0,  # kCFURLPOSIXPathStyle
            False,
        )

        destination = CGImageDestinationCreateWithURL(
            url, "public.jpeg", 1, None
        )
        if destination is None:
            logger.warning("Fast capture: failed to create image destination")
            return capture_screenshot(output_path, quality)

        properties = {"kCGImageDestinationLossyCompressionQuality": quality}
        CGImageDestinationAddImage(destination, image_ref, properties)
        success = CGImageDestinationFinalize(destination)

        if success:
            return output_path
        else:
            logger.warning("Fast capture: finalize failed, falling back")
            return capture_screenshot(output_path, quality)

    except Exception as e:
        logger.warning("Fast capture failed (%s), using fallback", e)
        return capture_screenshot(output_path, quality)


def check_screen_recording_permission() -> bool:
    """
    Best-effort check for Screen Recording permission.
    Attempts a test capture -- if the image is entirely
    transparent or None, permission is likely missing.
    """
    try:
        image_ref = CGWindowListCreateImage(
            CGRectInfinite,
            kCGWindowListOptionOnScreenOnly,
            kCGNullWindowID,
            0,
        )
        if image_ref is None:
            return False

        width = CGImageGetWidth(image_ref)
        height = CGImageGetHeight(image_ref)
        return width > 0 and height > 0

    except Exception:
        return False
