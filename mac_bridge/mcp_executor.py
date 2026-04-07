"""
Mac Bridge — Vision-Guided Executor
Used by mcp_server.py run_task() to drive the desktop step-by-step.
"""

import asyncio
import json
import os

import httpx

BRIDGE_URL = os.environ.get("BRIDGE_URL", "http://localhost:8891")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://100.74.135.83:11440")
VISION_MODEL = os.environ.get("VISION_MODEL", "gemma3:4b")

# Minimal system prompt — no reasoning, action JSON only
SYSTEM_PROMPT = (
    "Mac desktop controller. One action per response. JSON only.\n"
    '{"type":"click","x":450,"y":200} or {"type":"type","text":"hello"} or '
    '{"type":"key","keys":["cmd","s"]} or {"type":"scroll","x":400,"y":300,"direction":"down","amount":300} or '
    '{"type":"done","result":"description of what was accomplished"}'
)


# ---------------------------------------------------------------------------
# Bridge helpers
# ---------------------------------------------------------------------------

async def _bridge_post(client: httpx.AsyncClient, path: str, payload: dict) -> dict:
    resp = await client.post(f"{BRIDGE_URL}{path}", json=payload, timeout=30.0)
    resp.raise_for_status()
    return resp.json()


async def _bridge_get(client: httpx.AsyncClient, path: str) -> dict:
    resp = await client.get(f"{BRIDGE_URL}{path}", timeout=15.0)
    resp.raise_for_status()
    return resp.json()


async def _take_screenshot(client: httpx.AsyncClient) -> str:
    """Returns base64-encoded JPEG screenshot."""
    data = await _bridge_post(client, "/screenshot", {})
    return data.get("image_base64", "")


# ---------------------------------------------------------------------------
# Ollama vision call
# ---------------------------------------------------------------------------

async def _ask_vision(client: httpx.AsyncClient, task: str, screenshot_b64: str, step: int) -> str:
    """Send screenshot + task to Ollama vision model, return raw text response."""
    payload = {
        "model": VISION_MODEL,
        "system": SYSTEM_PROMPT,
        "prompt": f"Task: {task}\nStep {step}: What is the next action?",
        "images": [screenshot_b64],
        "stream": False,
        "options": {"temperature": 0.0, "num_predict": 128},
    }
    resp = await client.post(
        f"{OLLAMA_URL}/api/generate",
        json=payload,
        timeout=60.0,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("response", "").strip()


# ---------------------------------------------------------------------------
# Action parser
# ---------------------------------------------------------------------------

def _parse_action(text: str) -> dict | None:
    """Extract the first JSON object from the model response."""
    text = text.strip()
    # Find the first { ... } block
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


# ---------------------------------------------------------------------------
# Action executor — sends actions to bridge
# ---------------------------------------------------------------------------

async def _execute_action(client: httpx.AsyncClient, action: dict) -> dict:
    action_type = action.get("type", "")

    if action_type == "click":
        return await _bridge_post(client, "/click", {
            "x": action["x"],
            "y": action["y"],
            "button": action.get("button", "left"),
            "double": action.get("double", False),
        })

    if action_type == "type":
        return await _bridge_post(client, "/type", {"text": action["text"]})

    if action_type == "key":
        return await _bridge_post(client, "/hotkey", {"keys": action["keys"]})

    if action_type == "scroll":
        return await _bridge_post(client, "/scroll", {
            "x": action["x"],
            "y": action["y"],
            "direction": action.get("direction", "down"),
            "amount": action.get("amount", 3),  # bridge uses scroll clicks, not pixels
        })

    if action_type == "done":
        return {"status": "done", "result": action.get("result", "Task completed")}

    return {"error": f"Unknown action type: {action_type}"}


# ---------------------------------------------------------------------------
# Main executor loop
# ---------------------------------------------------------------------------

async def run_executor(task: str, max_steps: int = 30) -> dict:
    """
    Vision-guided executor loop:
    1. Take screenshot via bridge (:8891)
    2. Send to vision model via Ollama
    3. Parse action from response
    4. Execute action via bridge
    5. Repeat until done or max_steps reached
    """
    steps_log: list[dict] = []

    async with httpx.AsyncClient() as client:
        for step in range(1, max_steps + 1):
            # 1. Screenshot
            try:
                screenshot_b64 = await _take_screenshot(client)
            except Exception as e:
                return {
                    "success": False,
                    "steps_taken": step - 1,
                    "result": f"Screenshot failed at step {step}: {e}",
                    "steps": steps_log,
                }

            # 2. Ask vision model
            try:
                raw_response = await _ask_vision(client, task, screenshot_b64, step)
            except Exception as e:
                return {
                    "success": False,
                    "steps_taken": step - 1,
                    "result": f"Vision model failed at step {step}: {e}",
                    "steps": steps_log,
                }

            # 3. Parse action
            action = _parse_action(raw_response)
            if action is None:
                steps_log.append({"step": step, "raw": raw_response, "error": "parse_failed"})
                continue

            steps_log.append({"step": step, "action": action})

            # 4. Check for done
            if action.get("type") == "done":
                return {
                    "success": True,
                    "steps_taken": step,
                    "result": action.get("result", "Task completed"),
                    "steps": steps_log,
                }

            # 5. Execute action
            try:
                result = await _execute_action(client, action)
                steps_log[-1]["result"] = result
            except Exception as e:
                steps_log[-1]["error"] = str(e)
                # Non-fatal — continue loop

            # Small pause to let UI settle
            await asyncio.sleep(0.4)

    return {
        "success": False,
        "steps_taken": max_steps,
        "result": f"Reached max_steps ({max_steps}) without completing task",
        "steps": steps_log,
    }
