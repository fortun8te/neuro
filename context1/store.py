"""
ChromaDB wrapper with hybrid BM25 + dense vector search.

Ingestion
---------
Documents are word-chunked (512 words, 64-word overlap) and embedded
with sentence-transformers/all-MiniLM-L6-v2.

Search
------
1. Dense: query ChromaDB for top-N by cosine similarity.
2. BM25:  score the same candidates by keyword overlap with the query.
3. Merge: combine scores via Reciprocal Rank Fusion (RRF).
4. Exclude seen chunk_ids so every search surfaces fresh content.

Grep
----
Linear scan with Python re over all stored document texts.
Practical for collections up to ~100 K chunks; for larger corpora
replace with a dedicated text-search index.
"""
from __future__ import annotations

import re
import math
from typing import Optional

import chromadb
from sentence_transformers import SentenceTransformer


_EMBED_MODEL = "all-MiniLM-L6-v2"
_CHUNK_WORDS = 512
_CHUNK_OVERLAP = 64

# RRF constant – 60 is the standard value from the original paper
_RRF_K = 60


# ---------------------------------------------------------------------------
# Internal BM25 helpers (no extra dependency)
# ---------------------------------------------------------------------------

def _bm25_scores(
    query_terms: list[str],
    corpus: list[list[str]],
    k1: float = 1.5,
    b: float = 0.75,
) -> list[float]:
    if not corpus:
        return []

    N = len(corpus)
    avgdl = sum(len(d) for d in corpus) / N

    # Document frequency per term
    df: dict[str, int] = {}
    for doc in corpus:
        for term in set(doc):
            df[term] = df.get(term, 0) + 1

    scores: list[float] = []
    for doc in corpus:
        dl = len(doc)
        score = 0.0
        for term in query_terms:
            if term not in df:
                continue
            tf = doc.count(term)
            idf = math.log((N - df[term] + 0.5) / (df[term] + 0.5) + 1.0)
            tf_norm = (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * dl / avgdl))
            score += idf * tf_norm
        scores.append(score)
    return scores


def _rrf_merge(
    dense_ids: list[str],
    bm25_ids: list[str],
    k: int = _RRF_K,
) -> list[str]:
    """Return IDs ordered by Reciprocal Rank Fusion of two ranked lists."""
    scores: dict[str, float] = {}

    for rank, cid in enumerate(dense_ids, 1):
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (rank + k)

    for rank, cid in enumerate(bm25_ids, 1):
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (rank + k)

    return sorted(scores, key=scores.__getitem__, reverse=True)


# ---------------------------------------------------------------------------
# ChromaStore
# ---------------------------------------------------------------------------

class ChromaStore:
    def __init__(
        self,
        collection_name: str,
        persist_dir: str = "./chroma_db",
        embed_model: str = _EMBED_MODEL,
    ) -> None:
        self._client = chromadb.PersistentClient(path=persist_dir)
        self._embed  = SentenceTransformer(embed_model)
        self._col    = self._client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    # ------------------------------------------------------------------
    # Ingestion
    # ------------------------------------------------------------------

    def ingest(self, documents: list[dict]) -> None:
        """
        documents — list of {"id": str, "text": str}
        Chunks each document and upserts into ChromaDB.
        """
        ids, embeddings, texts, metas = [], [], [], []

        for doc in documents:
            doc_id = doc["id"]
            chunks = _word_chunk(doc["text"], _CHUNK_WORDS, _CHUNK_OVERLAP)

            for i, chunk_text in enumerate(chunks):
                chunk_id = f"{doc_id}:chunk_{i}"
                emb      = self._embed.encode(chunk_text).tolist()

                ids.append(chunk_id)
                embeddings.append(emb)
                texts.append(chunk_text)
                metas.append({
                    "doc_id":      doc_id,
                    "chunk_id":    chunk_id,
                    "chunk_index": i,
                })

        if ids:
            # Batch upsert in chunks of 500 (Chroma default limit)
            for start in range(0, len(ids), 500):
                sl = slice(start, start + 500)
                self._col.upsert(
                    ids=ids[sl],
                    embeddings=embeddings[sl],
                    documents=texts[sl],
                    metadatas=metas[sl],
                )

    # ------------------------------------------------------------------
    # Hybrid search
    # ------------------------------------------------------------------

    def search(
        self,
        query: str,
        top_k: int = 20,
        exclude_ids: Optional[set[str]] = None,
    ) -> list[dict]:
        """
        Hybrid BM25 + dense search.

        Returns list of dicts with keys:
            chunk_id, doc_id, text, chunk_index, similarity
        Chunks in exclude_ids are filtered out before returning.
        """
        total = self._col.count()
        if total == 0:
            return []

        # Fetch extra candidates to absorb exclusions
        fetch_n = min(total, max(top_k * 3, 50))

        query_emb = self._embed.encode(query).tolist()

        raw = self._col.query(
            query_embeddings=[query_emb],
            n_results=fetch_n,
            include=["documents", "metadatas", "distances"],
        )

        chunk_ids  = raw["ids"][0]
        texts_list = raw["documents"][0]
        metas_list = raw["metadatas"][0]
        distances  = raw["distances"][0]   # cosine distance (0 = identical)

        # Build candidate list (similarity = 1 – distance)
        candidates: list[dict] = []
        for cid, text, meta, dist in zip(chunk_ids, texts_list, metas_list, distances):
            if exclude_ids and cid in exclude_ids:
                continue
            candidates.append({
                "chunk_id":    cid,
                "doc_id":      meta["doc_id"],
                "text":        text,
                "chunk_index": meta.get("chunk_index", 0),
                "similarity":  1.0 - dist,
            })

        if not candidates:
            return []

        # BM25 re-rank over the dense candidates
        query_terms = query.lower().split()
        corpus_words = [c["text"].lower().split() for c in candidates]
        bm25_raw     = _bm25_scores(query_terms, corpus_words)

        # Rank by dense similarity, then by BM25
        dense_ranked = [c["chunk_id"] for c in candidates]
        bm25_ranked  = [
            c["chunk_id"]
            for c, _ in sorted(
                zip(candidates, bm25_raw), key=lambda x: x[1], reverse=True
            )
        ]

        merged_ids = _rrf_merge(dense_ranked, bm25_ranked)

        # Preserve full metadata
        id_to_candidate = {c["chunk_id"]: c for c in candidates}
        results = [id_to_candidate[cid] for cid in merged_ids if cid in id_to_candidate]

        return results[:top_k]

    # ------------------------------------------------------------------
    # Grep
    # ------------------------------------------------------------------

    def grep(
        self,
        pattern: str,
        max_results: int = 5,
        exclude_ids: Optional[set[str]] = None,
    ) -> list[dict]:
        """
        Regex search over all stored chunk texts.
        Returns up to max_results matches.
        """
        try:
            rx = re.compile(pattern, re.IGNORECASE)
        except re.error as exc:
            raise ValueError(f"Invalid regex pattern: {exc}") from exc

        # Retrieve all docs in batches
        limit = 1000
        offset = 0
        matches: list[dict] = []

        while True:
            batch = self._col.get(
                limit=limit,
                offset=offset,
                include=["documents", "metadatas"],
            )
            if not batch["ids"]:
                break

            for cid, text, meta in zip(
                batch["ids"], batch["documents"], batch["metadatas"]
            ):
                if exclude_ids and cid in exclude_ids:
                    continue
                if rx.search(text):
                    matches.append({
                        "chunk_id":    cid,
                        "doc_id":      meta["doc_id"],
                        "text":        text,
                        "chunk_index": meta.get("chunk_index", 0),
                    })
                    if len(matches) >= max_results:
                        return matches

            if len(batch["ids"]) < limit:
                break
            offset += limit

        return matches

    # ------------------------------------------------------------------
    # Read document
    # ------------------------------------------------------------------

    def get_document_chunks(self, doc_id: str) -> list[dict]:
        """Return all chunks for a document, sorted by chunk_index."""
        raw = self._col.get(
            where={"doc_id": doc_id},
            include=["documents", "metadatas"],
        )
        if not raw["ids"]:
            return []

        chunks = [
            {
                "chunk_id":    cid,
                "doc_id":      doc_id,
                "text":        text,
                "chunk_index": meta.get("chunk_index", 0),
            }
            for cid, text, meta in zip(
                raw["ids"], raw["documents"], raw["metadatas"]
            )
        ]
        return sorted(chunks, key=lambda c: c["chunk_index"])

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def count(self) -> int:
        return self._col.count()


# ---------------------------------------------------------------------------
# Text chunking
# ---------------------------------------------------------------------------

def _word_chunk(text: str, size: int, overlap: int) -> list[str]:
    words  = text.split()
    if not words:
        return []
    # Guard: overlap must be strictly less than size to guarantee forward progress
    step = max(size - overlap, 1)
    chunks = []
    start  = 0
    while start < len(words):
        end = start + size
        chunks.append(" ".join(words[start:end]))
        start += step
    return chunks
