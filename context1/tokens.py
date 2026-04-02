"""
Token counting utilities.
Uses tiktoken when available, falls back to 4 chars/token estimate.
"""
from __future__ import annotations
from typing import Sequence

try:
    import tiktoken
    _enc = tiktoken.get_encoding("cl100k_base")

    def count_tokens(text: str) -> int:
        return len(_enc.encode(text, disallowed_special=()))

except ImportError:
    def count_tokens(text: str) -> int:  # type: ignore[misc]
        return max(1, len(text) // 4)


# Per-message overhead that Ollama/OpenAI-style APIs add
_MSG_OVERHEAD = 4


def count_messages(messages: Sequence[dict]) -> int:
    """Estimate total tokens for a list of {role, content} messages."""
    total = 0
    for msg in messages:
        content = msg.get("content") or ""
        total += count_tokens(content) + _MSG_OVERHEAD
    return total


def token_budget_remaining(messages: Sequence[dict], cap: int) -> int:
    return cap - count_messages(messages)
