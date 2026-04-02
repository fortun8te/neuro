"""
Tool call parser for Context-1 model output.

The model emits tool calls in one of three formats (tried in order):
  1. <tool_call>{ ... }</tool_call>   — primary trained format
  2. ```json\n{ ... }\n```            — markdown code block fallback
  3. TOOL_CALL: { ... }               — plain-text fallback

Final answer detection: looks for <Document id=...> tags with no tool calls.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any


_XML_RE  = re.compile(r"<tool_call>\s*(.*?)\s*</tool_call>",  re.DOTALL)
_JSON_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?```",        re.DOTALL)
_PLAIN_RE = re.compile(r"TOOL_CALL:\s*(\{.*?\})",              re.DOTALL)
_DOC_RE  = re.compile(
    r"<Document\s+id=['\"]?([^'\">\s]+)['\"]?>\s*"
    r"<Justification>(.*?)</Justification>\s*</Document>",
    re.DOTALL,
)


@dataclass
class ToolCall:
    tool: str
    parameters: dict[str, Any]

    def __repr__(self) -> str:
        return f"ToolCall(tool={self.tool!r}, params={self.parameters})"


def _try_parse_json(raw: str) -> dict | None:
    try:
        data = json.loads(raw.strip())
        if isinstance(data, dict) and "tool" in data:
            return data
    except json.JSONDecodeError:
        pass
    return None


def parse_tool_calls(text: str) -> list[ToolCall]:
    """Extract all tool calls from a model response string."""
    seen: set[str] = set()
    calls: list[ToolCall] = []

    def _add(data: dict) -> None:
        key = json.dumps(data, sort_keys=True)
        if key in seen:
            return
        seen.add(key)
        calls.append(ToolCall(
            tool=data["tool"],
            parameters=data.get("parameters", {}),
        ))

    # Priority 1 — <tool_call> XML blocks
    for m in _XML_RE.finditer(text):
        data = _try_parse_json(m.group(1))
        if data:
            _add(data)

    # Priority 2 — ```json``` code blocks (only those with a "tool" key)
    for m in _JSON_RE.finditer(text):
        data = _try_parse_json(m.group(1))
        if data:
            _add(data)

    # Priority 3 — plain TOOL_CALL: {...}
    for m in _PLAIN_RE.finditer(text):
        data = _try_parse_json(m.group(1))
        if data:
            _add(data)

    return calls


def has_final_answer(text: str) -> bool:
    """True when the response contains at least one <Document> tag."""
    return bool(_DOC_RE.search(text))


def parse_final_results(text: str) -> list[dict[str, str]]:
    """Return list of {doc_id, justification} from the model's final answer."""
    return [
        {"doc_id": m.group(1).strip(), "justification": m.group(2).strip()}
        for m in _DOC_RE.finditer(text)
    ]
