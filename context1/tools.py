"""
Tool implementations for Context-1.

Each function returns:
    (header, chunks, new_chunk_ids)

  header        — human-readable summary line(s) for the model
  chunks        — list[ChunkContent] to store in trajectory
  new_chunk_ids — chunk IDs to register as seen/active (empty for prune)

Token budget per call is passed in so search_corpus and read_document
can truncate results to fit the remaining space.
"""
from __future__ import annotations

from typing import Optional

from .store import ChromaStore
from .tokens import count_tokens
from .trajectory import ChunkContent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _truncate_to_budget(text: str, budget_tokens: int) -> str:
    """Hard-truncate text to fit inside a token budget (with marker)."""
    if count_tokens(text) <= budget_tokens:
        return text
    # Binary-search on character length
    lo, hi = 0, len(text)
    while lo < hi - 1:
        mid = (lo + hi) // 2
        if count_tokens(text[:mid]) <= budget_tokens - 5:
            lo = mid
        else:
            hi = mid
    return text[:lo] + "\n…[truncated]"


# ---------------------------------------------------------------------------
# search_corpus
# ---------------------------------------------------------------------------

def search_corpus(
    store: ChromaStore,
    query: str,
    seen_ids: set[str],
    token_budget: int = 4_000,
    top_k: int = 20,
) -> tuple[str, list[ChunkContent], list[str]]:
    """
    Hybrid BM25 + dense search, excluding already-seen chunks.
    Results are packed into token_budget tokens total.
    """
    results = store.search(query, top_k=top_k, exclude_ids=seen_ids)

    if not results:
        return f"No new results for: '{query}'", [], []

    header = f"search_corpus(query={query!r}) — {len(results)} result(s)"
    chunks: list[ChunkContent] = []
    new_ids: list[str] = []
    tokens_used = count_tokens(header)

    for r in results:
        text = r["text"]
        prefix = f"chunk_id={r['chunk_id']}  doc_id={r['doc_id']}\n"
        entry_tokens = count_tokens(prefix + text)

        if tokens_used + entry_tokens > token_budget:
            # Try to fit a truncated version
            headroom = token_budget - tokens_used - count_tokens(prefix) - 10
            if headroom > 80:
                text = _truncate_to_budget(text, headroom)
                entry_tokens = count_tokens(prefix + text)
            else:
                break  # Out of budget entirely

        chunks.append(ChunkContent(
            chunk_id=    r["chunk_id"],
            doc_id=      r["doc_id"],
            text=        text,
            index=       r.get("chunk_index", 0),
        ))
        new_ids.append(r["chunk_id"])
        tokens_used += entry_tokens

    return header, chunks, new_ids


# ---------------------------------------------------------------------------
# grep_corpus
# ---------------------------------------------------------------------------

def grep_corpus(
    store: ChromaStore,
    pattern: str,
    seen_ids: set[str],
) -> tuple[str, list[ChunkContent], list[str]]:
    """Regex search over raw document text; up to 5 matches."""
    try:
        results = store.grep(pattern, max_results=5, exclude_ids=seen_ids)
    except ValueError as exc:
        return f"grep_corpus error: {exc}", [], []

    if not results:
        return f"grep_corpus(pattern={pattern!r}) — no matches", [], []

    header = f"grep_corpus(pattern={pattern!r}) — {len(results)} match(es)"
    chunks = [
        ChunkContent(
            chunk_id= r["chunk_id"],
            doc_id=   r["doc_id"],
            text=     r["text"],
            index=    r.get("chunk_index", 0),
        )
        for r in results
    ]
    new_ids = [r["chunk_id"] for r in results]
    return header, chunks, new_ids


# ---------------------------------------------------------------------------
# read_document
# ---------------------------------------------------------------------------

def read_document(
    store: ChromaStore,
    doc_id: str,
    seen_ids: set[str],
    token_budget: int = 8_000,
) -> tuple[str, list[ChunkContent], list[str]]:
    """Return all chunks of a document, packed into token_budget tokens."""
    doc_chunks = store.get_document_chunks(doc_id)

    if not doc_chunks:
        return f"read_document: doc_id={doc_id!r} not found.", [], []

    # Filter out already-seen chunks so the model never sees duplicates
    unseen_chunks = [ch for ch in doc_chunks if ch["chunk_id"] not in seen_ids]
    skipped = len(doc_chunks) - len(unseen_chunks)

    header = f"read_document(doc_id={doc_id!r}) — {len(unseen_chunks)} new chunk(s)"
    if skipped:
        header += f" ({skipped} already seen, skipped)"

    chunks: list[ChunkContent] = []
    new_ids: list[str] = []
    tokens_used = count_tokens(header)

    for ch in unseen_chunks:
        text = ch["text"]
        prefix = f"chunk_id={ch['chunk_id']}\n"
        entry_tokens = count_tokens(prefix + text)

        if tokens_used + entry_tokens > token_budget:
            headroom = token_budget - tokens_used - count_tokens(prefix) - 10
            if headroom > 80:
                text = _truncate_to_budget(text, headroom)
                entry_tokens = count_tokens(prefix + text)
            else:
                break

        chunks.append(ChunkContent(
            chunk_id= ch["chunk_id"],
            doc_id=   doc_id,
            text=     text,
            index=    ch.get("chunk_index", 0),
        ))
        new_ids.append(ch["chunk_id"])
        tokens_used += entry_tokens

    return header, chunks, new_ids


# ---------------------------------------------------------------------------
# prune_chunks
# ---------------------------------------------------------------------------

def prune_chunks(
    chunk_ids: list[str],
    trajectory,               # Trajectory — avoids circular import
) -> tuple[str, list[ChunkContent], list[str]]:
    """
    Remove chunks from the active trajectory window.
    The shadow trajectory retains the original content.
    Returns (header, [], []) — no new chunks are added.
    """
    pruned   = trajectory.prune(chunk_ids)
    missing  = [cid for cid in chunk_ids if cid not in pruned]

    parts: list[str] = []
    if pruned:
        parts.append(
            f"Pruned {len(pruned)} chunk(s) from active context: "
            + ", ".join(pruned)
        )
    if missing:
        parts.append(
            f"Not in active context (already pruned or never seen): "
            + ", ".join(missing)
        )

    header = "prune_chunks — " + "; ".join(parts) if parts else "prune_chunks — nothing to prune"
    return header, [], []
