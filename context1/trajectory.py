"""
Trajectory management for Context-1.

Two parallel records are maintained:

  active   — what the model sees on every inference call.
             Pruned chunk content is replaced with "[pruned]" markers,
             which actually frees token budget.

  shadow   — immutable full history used for logging / evaluation.
             Nothing is ever removed from the shadow.

The key abstraction is TrajectoryEntry, which can hold either a plain
text message (system / user / assistant) or a structured tool-result
message whose individual chunks can be pruned without rebuilding the
entire conversation.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Optional, Sequence

from .tokens import count_tokens


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class ChunkContent:
    """One retrieved chunk inside a tool-result entry."""
    chunk_id: str
    doc_id:   str
    text:     str
    index:    int = 0          # chunk_index within its document


@dataclass
class TrajectoryEntry:
    """
    A single entry in the trajectory.

    Plain messages (system / user / assistant) use `text`.
    Tool results use `tool_name`, `header`, `chunks`, and `footer`.
    """
    role:       str                        # "system" | "user" | "assistant" | "tool_result"
    text:       Optional[str] = None       # plain messages
    tool_name:  Optional[str] = None       # tool result entries
    header:     Optional[str] = None       # e.g. "Search results for: '...'"
    chunks:     list[ChunkContent] = field(default_factory=list)
    footer:     Optional[str] = None       # token usage note
    shadow_only: bool = False              # if True: kept in shadow but never sent to model

    # ------------------------------------------------------------------
    def to_ollama_message(self, pruned_ids: frozenset[str]) -> dict:
        """Serialise to an Ollama {role, content} dict.

        For tool results, chunks whose chunk_id is in pruned_ids are
        replaced with a one-line marker, shrinking the effective context.
        """
        if self.role in ("system", "user", "assistant"):
            return {"role": self.role, "content": self.text or ""}

        if self.role == "tool_result":
            parts: list[str] = []
            if self.header:
                parts.append(self.header)

            for chunk in self.chunks:
                if chunk.chunk_id in pruned_ids:
                    parts.append(
                        f"[chunk_id={chunk.chunk_id} doc_id={chunk.doc_id}: "
                        f"pruned from context]"
                    )
                else:
                    parts.append(
                        f"chunk_id={chunk.chunk_id}  doc_id={chunk.doc_id}\n"
                        f"{chunk.text}"
                    )

            if self.footer:
                parts.append(self.footer)

            content = "\n\n".join(parts)
            return {
                "role":    "user",
                "content": f"[Tool result: {self.tool_name}]\n{content}",
            }

        # Fallback
        return {"role": "user", "content": self.text or ""}

    def token_count(self, pruned_ids: frozenset[str]) -> int:
        return count_tokens(self.to_ollama_message(pruned_ids)["content"])


# ---------------------------------------------------------------------------
# Trajectory
# ---------------------------------------------------------------------------

class Trajectory:
    """
    Dual-track message trajectory.

    Public attributes
    -----------------
    seen_chunk_ids   — every chunk ever retrieved; used as exclusion filter
                       on every search so the model never sees duplicates.
    active_chunk_ids — subset currently visible in the active trajectory;
                       chunks removed here still appear in shadow.
    pruned_chunk_ids — chunks that have been pruned; their text is replaced
                       with markers when building Ollama messages.
    """

    def __init__(self) -> None:
        self._active: list[TrajectoryEntry]  = []
        self._shadow: list[TrajectoryEntry]  = []

        self.seen_chunk_ids:   set[str] = set()
        self.active_chunk_ids: set[str] = set()
        self.pruned_chunk_ids: set[str] = set()

    # ------------------------------------------------------------------
    # Adding entries
    # ------------------------------------------------------------------

    def add(self, entry: TrajectoryEntry) -> None:
        """Append to both active and shadow."""
        if not entry.shadow_only:
            self._active.append(entry)
        # Shadow always gets a deep copy so it is never mutated
        shadow_copy = copy.deepcopy(entry)
        self._shadow.append(shadow_copy)

    def add_system(self, text: str) -> None:
        self.add(TrajectoryEntry(role="system", text=text))

    def add_user(self, text: str) -> None:
        self.add(TrajectoryEntry(role="user", text=text))

    def add_assistant(self, text: str) -> None:
        self.add(TrajectoryEntry(role="assistant", text=text))

    def add_tool_result(
        self,
        tool_name: str,
        header: str,
        chunks: list[ChunkContent],
        footer: str,
    ) -> None:
        entry = TrajectoryEntry(
            role=       "tool_result",
            tool_name=  tool_name,
            header=     header,
            chunks=     chunks,
            footer=     footer,
        )
        self.add(entry)
        # Register chunks as seen + active
        for c in chunks:
            self.seen_chunk_ids.add(c.chunk_id)
            self.active_chunk_ids.add(c.chunk_id)

    def add_shadow_note(self, text: str) -> None:
        """Record a note in shadow only (never sent to model)."""
        self.add(TrajectoryEntry(role="user", text=text, shadow_only=True))

    # ------------------------------------------------------------------
    # Pruning
    # ------------------------------------------------------------------

    def prune(self, chunk_ids: Sequence[str]) -> list[str]:
        """
        Mark chunks as pruned.  Their text will be replaced by markers
        in the next Ollama message build, actually freeing token budget.

        Returns the list of chunk_ids that were actually in active context.
        """
        pruned: list[str] = []
        for cid in chunk_ids:
            if cid in self.active_chunk_ids:
                self.active_chunk_ids.discard(cid)
                self.pruned_chunk_ids.add(cid)
                pruned.append(cid)
        return pruned

    # ------------------------------------------------------------------
    # Building messages for Ollama
    # ------------------------------------------------------------------

    def to_ollama_messages(self) -> list[dict]:
        frozen_pruned = frozenset(self.pruned_chunk_ids)
        return [
            e.to_ollama_message(frozen_pruned)
            for e in self._active
        ]

    # ------------------------------------------------------------------
    # Shadow export (for logging / eval)
    # ------------------------------------------------------------------

    def shadow_log(self) -> list[dict]:
        """Full history including pruned content, for inspection."""
        out = []
        for e in self._shadow:
            if e.role == "tool_result":
                chunks_info = [
                    {
                        "chunk_id": c.chunk_id,
                        "doc_id":   c.doc_id,
                        "pruned":   c.chunk_id in self.pruned_chunk_ids,
                        "text":     c.text[:200] + "…" if len(c.text) > 200 else c.text,
                    }
                    for c in e.chunks
                ]
                out.append({
                    "role":       e.role,
                    "tool_name":  e.tool_name,
                    "header":     e.header,
                    "chunks":     chunks_info,
                    "shadow_only": e.shadow_only,
                })
            else:
                content = e.text or ""
                out.append({
                    "role":        e.role,
                    "content":     content[:500] + "…" if len(content) > 500 else content,
                    "shadow_only": e.shadow_only,
                })
        return out
