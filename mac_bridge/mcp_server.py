#!/opt/homebrew/bin/python3.11
"""
Mac Desktop MCP Server
Exposes Mac desktop control capabilities as MCP tools via FastMCP.
Communicates with bridge_server on :8891 for all desktop actions.
"""

import os

import httpx
from fastmcp import FastMCP

from mcp_executor import run_executor

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BRIDGE_URL = os.environ.get("BRIDGE_URL", "http://localhost:8891")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://100.74.135.83:11440")

mcp = FastMCP("mac-desktop")


# ---------------------------------------------------------------------------
# Bridge helper
# ---------------------------------------------------------------------------

async def _bridge(method: str, path: str, **kwargs) -> dict:
    async with httpx.AsyncClient() as client:
        fn = getattr(client, method)
        resp = await fn(f"{BRIDGE_URL}{path}", timeout=30.0, **kwargs)
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def take_screenshot() -> dict:
    """Take a screenshot of the current Mac desktop. Returns base64 JPEG in image_base64 field."""
    return await _bridge("post", "/screenshot")


@mcp.tool()
async def click(x: int, y: int, button: str = "left", double: bool = False) -> dict:
    """Click at pixel coordinates on the Mac desktop.

    x, y: logical pixel coordinates (not Retina physical pixels)
    button: 'left' or 'right'
    double: True for double-click
    """
    return await _bridge("post", "/click", json={
        "x": x,
        "y": y,
        "button": button,
        "double": double,
    })


@mcp.tool()
async def type_text(text: str) -> dict:
    """Type text at the current cursor position."""
    return await _bridge("post", "/type", json={"text": text})


@mcp.tool()
async def press_key(keys: list[str]) -> dict:
    """Press a keyboard shortcut.

    Example: ['cmd', 's'] for Command+S, ['return'] for Enter.
    Supported modifiers: cmd, ctrl, alt/option, shift, fn.
    """
    return await _bridge("post", "/hotkey", json={"keys": keys})


@mcp.tool()
async def scroll(x: int, y: int, direction: str, amount: int = 3) -> dict:
    """Scroll at coordinates.

    x, y: coordinates to scroll at
    direction: 'up' or 'down'
    amount: number of scroll clicks (default 3; use 10+ for large pages)
    """
    return await _bridge("post", "/scroll", json={
        "x": x,
        "y": y,
        "direction": direction,
        "amount": amount,
    })


@mcp.tool()
async def get_screen_info() -> dict:
    """Get screen dimensions (logical pixel width and height) from the bridge health endpoint."""
    return await _bridge("get", "/health")


@mcp.tool()
async def run_task(task: str, max_steps: int = 30) -> dict:
    """Run a complete task using the vision-guided executor.

    The executor takes screenshots, decides actions, executes them, and repeats
    until the task is done or max_steps is reached.

    Examples:
      - "Open Safari and go to google.com"
      - "Open Terminal and run: ls -la ~/Desktop"
      - "Take a screenshot and save it to ~/Desktop/screenshot.png"
      - "Open System Settings and navigate to Display"

    Returns:
      success: whether the task completed
      steps_taken: number of steps executed
      result: description of what was accomplished (or why it failed)
      steps: detailed log of each step and action taken
    """
    return await run_executor(task=task, max_steps=max_steps)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run()
