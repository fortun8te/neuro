"""
Context-1 Agent Harness
=======================
State machine wrapping Ollama inference in an observe → reason → act loop.

Loop
----
1. User provides a query.
2. Harness builds initial trajectory (system prompt + user query).
3. Inference: call Ollama with full active trajectory.
4. Parse response for tool calls.
5. Execute tool calls; append results + token note to trajectory.
6. Repeat until model produces a final answer (no tool calls, has <Document>
   tags) or max_iterations is reached.

Token budget
------------
  Hard cap   : 32 768 tokens  (model's context window)
  Soft warn  : 24 000 tokens  → inject advisory, model should prune
  Hard cutoff: 30 000 tokens  → reject all tool calls except prune_chunks
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from typing import Optional

import ollama

from .parser  import parse_tool_calls, has_final_answer, parse_final_results
from .store   import ChromaStore
from .tokens  import count_messages, count_tokens
from .tools   import search_corpus, grep_corpus, read_document, prune_chunks
from .trajectory import Trajectory, TrajectoryEntry, ChunkContent


# ---------------------------------------------------------------------------
# Budget constants
# ---------------------------------------------------------------------------

TOKEN_HARD_CAP    = 32_768
TOKEN_SOFT_WARN   = 24_000
TOKEN_HARD_CUTOFF = 30_000

# Per-tool token budget for results (proportional to remaining space)
_SEARCH_BUDGET   = 4_000
_READ_BUDGET     = 8_000


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a retrieval subagent in a multi-agent system. Your role is to find \
and retrieve the most relevant documents from a corpus to help answer a query. \
You do NOT answer questions yourself — you only find and retrieve relevant documents.

You have access to four tools. Call them by emitting a JSON block inside \
<tool_call> tags:

<tool_call>
{"tool": "<name>", "parameters": {<params>}}
</tool_call>

Available tools
---------------

1. search_corpus(query: str)
   Hybrid BM25 + dense semantic search. Returns numbered chunks with chunk_id
   and doc_id. Every call automatically excludes chunks you have already seen.
   Example:
     <tool_call>
     {"tool": "search_corpus", "parameters": {"query": "deep learning optimisation"}}
     </tool_call>

2. grep_corpus(pattern: str)
   Regex search over raw document text. Returns up to 5 matching chunks.
   Example:
     <tool_call>
     {"tool": "grep_corpus", "parameters": {"pattern": "\\\\bbackpropagation\\\\b"}}
     </tool_call>

3. read_document(doc_id: str)
   Retrieve the full content of a document by its doc_id.
   Example:
     <tool_call>
     {"tool": "read_document", "parameters": {"doc_id": "paper_42"}}
     </tool_call>

4. prune_chunks(chunk_ids: list[str])
   Remove irrelevant chunks from your active context to free token space.
   Use this aggressively when context fills up — pruned chunks are gone from
   your view but their IDs remain excluded from future searches.
   Example:
     <tool_call>
     {"tool": "prune_chunks", "parameters": {"chunk_ids": ["doc1:chunk_0", "doc2:chunk_3"]}}
     </tool_call>

Your process
------------
1. Break the query into key concepts.
2. Plan multiple distinct search strategies (semantic, keyword, regex).
3. After each round: assess what you know, what is missing, what to prune.
4. When confident you have the relevant documents, output your final ranked list.

Always monitor your token usage (shown after every tool result). When context
fills up, prune aggressively before searching further.

Output format for final answer
-------------------------------
Emit one block per relevant document, ranked by relevance (most relevant first):

<Document id=DOC_ID><Justification>Why this document is relevant.</Justification></Document>

Do NOT answer the query yourself. Only retrieve and rank documents.\
"""


# ---------------------------------------------------------------------------
# ContextHarness
# ---------------------------------------------------------------------------

class ContextHarness:
    """
    Public interface:

        harness = ContextHarness(ollama_model="context-1-q8", chroma_collection="my_docs")
        harness.ingest(documents)          # list of {"id": str, "text": str}
        results = harness.query("...")     # list of {"doc_id": str, "justification": str}
    """

    def __init__(
        self,
        ollama_model:      str  = "context-1-q8",
        chroma_collection: str  = "my_docs",
        chroma_persist_dir: str = "./chroma_db",
        max_iterations:    int  = 20,
        log_level:         int  = logging.INFO,
        log_file: Optional[str] = None,
        stream_output:     bool = True,
    ) -> None:
        self.model          = ollama_model
        self.max_iterations = max_iterations
        self.stream_output  = stream_output

        self._store = ChromaStore(chroma_collection, persist_dir=chroma_persist_dir)

        # Logging ─────────────────────────────────────────────────────────
        self.log = logging.getLogger(f"context1.{chroma_collection}")
        self.log.setLevel(log_level)
        fmt = logging.Formatter("%(asctime)s  %(levelname)-8s  %(message)s")
        if not self.log.handlers:
            sh = logging.StreamHandler(sys.stderr)
            sh.setFormatter(fmt)
            self.log.addHandler(sh)
        if log_file:
            fh = logging.FileHandler(log_file)
            fh.setFormatter(fmt)
            self.log.addHandler(fh)

        self.log.info(
            "ContextHarness ready  model=%s  collection=%s  docs=%d",
            ollama_model, chroma_collection, self._store.count(),
        )

    # ------------------------------------------------------------------
    # Ingestion
    # ------------------------------------------------------------------

    def ingest(self, documents: list[dict]) -> None:
        """
        Ingest documents into ChromaDB.

        documents — list of {"id": str, "text": str}
        """
        self.log.info("Ingesting %d documents…", len(documents))
        self._store.ingest(documents)
        self.log.info("Ingestion done.  Total chunks: %d", self._store.count())

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def query(self, query: str) -> list[dict]:
        """
        Run the agent loop and return ranked documents.

        Returns list of {"doc_id": str, "justification": str}.
        """
        self.log.info("━" * 60)
        self.log.info("QUERY: %s", query)
        self.log.info("━" * 60)

        traj = Trajectory()
        traj.add_system(SYSTEM_PROMPT)
        traj.add_user(f"Query: {query}")

        soft_warned = False

        for iteration in range(1, self.max_iterations + 1):
            self.log.info("── Iteration %d/%d ──", iteration, self.max_iterations)

            # ── Build messages and check token budget ──────────────────
            messages     = traj.to_ollama_messages()
            current_tok  = count_messages(messages)
            self.log.info("Token usage: %d / %d", current_tok, TOKEN_HARD_CAP)

            if current_tok >= TOKEN_HARD_CAP:
                self.log.warning("Hard token cap reached — forcing conclusion.")
                break

            if current_tok >= TOKEN_SOFT_WARN and not soft_warned:
                advisory = (
                    "Context is filling up. Consider pruning irrelevant chunks "
                    "or providing your final answer."
                )
                traj.add_system(advisory)
                soft_warned = True
                self.log.info("Soft-warn advisory injected.")
                messages = traj.to_ollama_messages()

            # ── Inference ─────────────────────────────────────────────
            response = self._infer(messages)
            traj.add_assistant(response)
            self.log.debug("Model response (%d chars):\n%s", len(response), response)

            # ── Final answer? ──────────────────────────────────────────
            if has_final_answer(response) and not parse_tool_calls(response):
                self.log.info("Final answer received.")
                results = parse_final_results(response)
                self._emit_shadow_log(traj)
                return results

            # ── Parse tool calls ───────────────────────────────────────
            tool_calls = parse_tool_calls(response)

            if not tool_calls:
                # Model produced neither tool calls nor a final answer
                self.log.warning("No tool calls and no final answer — nudging model.")
                traj.add_user(
                    "Please call a tool to retrieve more documents, "
                    "or output your final ranked list using <Document id=…> tags."
                )
                continue

            # ── Execute each tool call ─────────────────────────────────
            result_chunks_combined: list[ChunkContent] = []
            result_headers: list[str] = []
            new_ids_all: list[str] = []
            running_tok = current_tok  # Track cumulative tokens across calls

            for tc in tool_calls:
                self.log.info("Tool call: %s(%s)", tc.tool, tc.parameters)

                # Hard cutoff — only prune_chunks is allowed
                if running_tok >= TOKEN_HARD_CUTOFF and tc.tool != "prune_chunks":
                    error_header = (
                        f"[Tool: {tc.tool}] REJECTED — Token budget critical "
                        f"({running_tok}/{TOKEN_HARD_CAP}). "
                        f"You must call prune_chunks or provide your final answer."
                    )
                    result_headers.append(error_header)
                    self.log.warning("Rejected %s — over hard cutoff.", tc.tool)
                    continue

                header, chunks, new_ids = self._execute(tc, traj, running_tok)

                result_headers.append(header)
                result_chunks_combined.extend(chunks)
                new_ids_all.extend(new_ids)

                # Update running token count so next tool call sees accurate budget
                for c in chunks:
                    running_tok += count_tokens(f"chunk_id={c.chunk_id}\n{c.text}")

            # ── Append results to trajectory ───────────────────────────
            token_note = f"[Token usage: {running_tok}/{TOKEN_HARD_CAP}]"

            combined_header = "\n".join(result_headers)
            traj.add_tool_result(
                tool_name= _tool_name_label(tool_calls),
                header=    combined_header,
                chunks=    result_chunks_combined,
                footer=    token_note,
            )

        # ── Max iterations reached ─────────────────────────────────────
        self.log.warning("Max iterations (%d) reached.", self.max_iterations)
        self._emit_shadow_log(traj)

        # Return any partial results from last assistant message
        for entry in reversed(traj._active):
            if entry.role == "assistant" and entry.text:
                results = parse_final_results(entry.text)
                if results:
                    return results

        return []

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def _infer(self, messages: list[dict]) -> str:
        """Stream from Ollama and return the full response string."""
        parts: list[str] = []

        if self.stream_output:
            print("\n[Context-1] ", end="", flush=True)

        try:
            stream = ollama.chat(
                model=   self.model,
                messages=messages,
                stream=  True,
            )
            for chunk in stream:
                content = chunk.get("message", {}).get("content", "")
                if content:
                    parts.append(content)
                    if self.stream_output:
                        print(content, end="", flush=True)
        except Exception as exc:
            self.log.error("Ollama error: %s", exc)
            raise

        if self.stream_output:
            print()  # newline after streaming

        return "".join(parts)

    # ------------------------------------------------------------------
    # Tool dispatch
    # ------------------------------------------------------------------

    def _execute(
        self,
        tc,                 # parser.ToolCall
        traj: Trajectory,
        current_tok: int,
    ) -> tuple[str, list[ChunkContent], list[str]]:
        """Dispatch a single tool call; return (header, chunks, new_ids)."""

        remaining = max(TOKEN_HARD_CAP - current_tok - 2_000, 1_000)  # reserve 2k for model reply

        name = tc.tool
        p    = tc.parameters

        if name == "search_corpus":
            query = p.get("query", "")
            if not query:
                return "search_corpus: missing 'query' parameter.", [], []
            return search_corpus(
                self._store, query,
                seen_ids=    traj.seen_chunk_ids,
                token_budget=min(remaining, _SEARCH_BUDGET),
            )

        if name == "grep_corpus":
            pattern = p.get("pattern", "")
            if not pattern:
                return "grep_corpus: missing 'pattern' parameter.", [], []
            return grep_corpus(
                self._store, pattern,
                seen_ids=traj.seen_chunk_ids,
            )

        if name == "read_document":
            doc_id = p.get("doc_id", "")
            if not doc_id:
                return "read_document: missing 'doc_id' parameter.", [], []
            return read_document(
                self._store, doc_id,
                seen_ids=    traj.seen_chunk_ids,
                token_budget=min(remaining, _READ_BUDGET),
            )

        if name == "prune_chunks":
            chunk_ids = p.get("chunk_ids", [])
            if not chunk_ids:
                return "prune_chunks: missing 'chunk_ids' parameter.", [], []
            return prune_chunks(chunk_ids, traj)

        return f"Unknown tool: {name!r}", [], []

    # ------------------------------------------------------------------
    # Shadow log
    # ------------------------------------------------------------------

    def _emit_shadow_log(self, traj: Trajectory) -> None:
        shadow = traj.shadow_log()
        self.log.debug("Shadow trajectory (%d entries):", len(shadow))
        for i, entry in enumerate(shadow):
            role = entry.get("role", "?")
            if "chunks" in entry:
                self.log.debug(
                    "  [%d] %s tool=%s  chunks=%d",
                    i, role, entry.get("tool_name"), len(entry.get("chunks", [])),
                )
            else:
                snippet = (entry.get("content") or "")[:120].replace("\n", " ")
                self.log.debug("  [%d] %s: %s", i, role, snippet)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tool_name_label(tool_calls) -> str:
    names = [tc.tool for tc in tool_calls]
    return names[0] if len(names) == 1 else f"multiple ({', '.join(names)})"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Context-1 retrieval agent harness",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--query",   "-q", required=True,               help="Query to run")
    p.add_argument("--model",   "-m", default="context-1-q8",      help="Ollama model tag")
    p.add_argument("--collection", "-c", default="my_docs",        help="ChromaDB collection")
    p.add_argument("--chroma-dir",       default="./chroma_db",    help="ChromaDB persist dir")
    p.add_argument("--max-iter",  type=int, default=20,            help="Max agent iterations")
    p.add_argument("--ingest",    "-i",                            help="JSON file of docs to ingest")
    p.add_argument("--log-file",                                   help="Write logs to file")
    p.add_argument("--verbose",   "-v", action="store_true",       help="DEBUG logging")
    p.add_argument("--no-stream", action="store_true",             help="Disable streaming output")
    return p


def main() -> None:
    args = _build_parser().parse_args()

    harness = ContextHarness(
        ollama_model=      args.model,
        chroma_collection= args.collection,
        chroma_persist_dir=args.chroma_dir,
        max_iterations=    args.max_iter,
        log_level=         logging.DEBUG if args.verbose else logging.INFO,
        log_file=          args.log_file,
        stream_output=     not args.no_stream,
    )

    if args.ingest:
        with open(args.ingest) as f:
            documents = json.load(f)
        harness.ingest(documents)

    results = harness.query(args.query)

    print("\n" + "=" * 60)
    print("FINAL RANKED RESULTS")
    print("=" * 60)
    if not results:
        print("(no results returned)")
    for rank, r in enumerate(results, 1):
        print(f"\n[{rank}] {r['doc_id']}")
        print(f"    {r['justification']}")
    print()


if __name__ == "__main__":
    main()
