"""
context1 — Python harness for the Context-1 retrieval subagent model.

Quick start
-----------
    from context1 import ContextHarness

    harness = ContextHarness(
        ollama_model="context-1-q8",
        chroma_collection="my_docs",
    )
    harness.ingest([{"id": "doc1", "text": "..."}])
    results = harness.query("What does the paper say about attention?")
    # [{"doc_id": "doc1", "justification": "..."}, ...]
"""

from .harness    import ContextHarness
from .store      import ChromaStore
from .trajectory import Trajectory
from .tokens     import count_tokens, count_messages

__all__ = [
    "ContextHarness",
    "ChromaStore",
    "Trajectory",
    "count_tokens",
    "count_messages",
]
