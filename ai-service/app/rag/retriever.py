"""
Retrieval — the sole implementation of vector/hybrid search over
resource_chunks. Node's server/services/ragService.js now only proxies here
(server/services/aiServiceClient.js); nothing computes similarity anywhere
else, so there is exactly one vector-search implementation in the project.

Similarity is computed by PostgreSQL/pgvector's `<=>` cosine-distance
operator (`similarity = 1 - distance`), inside the same query that applies
the subject/grade/embedding-model prefilter — never by pulling every chunk's
embedding into this process and comparing in application code. The SELECT
below returns `text`/`title`/`subject`/`grade`/`similarity` only; the
`embedding` column itself never leaves PostgreSQL.

No ANN index (HNSW/IVFFlat) on resource_chunks.embedding: the library is
~8 resources / ~20-40 chunks, so an exact sequential scan is both fast and
reproduces today's ranking exactly. It would also not be possible to index
as-is — pgvector's HNSW/IVFFlat cap out at 2000 dimensions for the plain
`vector` type, and these embeddings are 3072-dimensional (gemini-embedding-001,
verified against the actual stored data when the schema was built). Revisit
(halfvec, or a smaller embedding dimension) only once chunk count and query
volume make an approximate index worth the ranking risk.
"""

import re
from dataclasses import dataclass
from typing import Literal, Optional

import asyncpg
from langchain_core.callbacks import AsyncCallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever

from .lexical import bm25_scores, reciprocal_rank_fusion

Mode = Literal["vector", "hybrid"]

_GRADE_NUMBER_RE = re.compile(r"\d+")


def parse_grade_number(grade: Optional[str]) -> Optional[int]:
    if not grade:
        return None
    m = _GRADE_NUMBER_RE.search(grade)
    return int(m.group()) if m else None


@dataclass
class RetrievedChunk:
    text: str
    similarity: float
    source: dict
    lexical: float = 0.0
    score: float = 0.0  # hybrid fused score; unused in vector mode


def _rank_hybrid(candidates: list[RetrievedChunk], min_similarity: float) -> list[RetrievedChunk]:
    """
    Fuse the cosine ranking and the BM25 ranking with Reciprocal Rank Fusion,
    then gate. Exact port of ragService.js `rankHybrid`: a chunk is kept if it
    clears the semantic threshold, OR it is a strong keyword match (at least
    half the best BM25 score) that is only a little below threshold (floor
    0.04) — the second clause rescues exact-term queries whose embeddings
    drift, the cosine floor stops a shared common word from dragging in an
    unrelated chunk.
    """
    by_vector = sorted(range(len(candidates)), key=lambda i: candidates[i].similarity, reverse=True)
    by_lexical = sorted(
        (i for i in range(len(candidates)) if candidates[i].lexical > 0),
        key=lambda i: candidates[i].lexical,
        reverse=True,
    )
    # Semantic ranking counts double: keywords rescue exact terms the
    # embedding drifted on, not to outvote meaning.
    fused = reciprocal_rank_fusion([by_vector, by_lexical], len(candidates), 60, [1, 0.5])
    max_lexical = max((c.lexical for c in candidates), default=0.0)
    max_lexical = max(max_lexical, 0.0)

    kept = []
    for i, c in enumerate(candidates):
        c.score = fused[i]
        if c.similarity >= min_similarity or (
            max_lexical > 0 and c.lexical >= 0.5 * max_lexical and c.similarity >= min_similarity - 0.04
        ):
            kept.append(c)
    kept.sort(key=lambda c: c.score, reverse=True)
    return kept


async def _fetch_candidates(
    pool: asyncpg.Pool,
    query_embedding: list[float],
    subject: str,
    grade: str,
    embedding_model: str,
) -> list[RetrievedChunk]:
    requested_number = parse_grade_number(grade)

    # $1 = query embedding, $2 = subject pattern; grade and embedding-model
    # placeholders are numbered from a running counter so the clause text and
    # the params list can never drift out of sync.
    params: list = [query_embedding, f"%{subject}%"]
    next_param = 3

    if requested_number is None:
        grade_clause = f"(r.grade ILIKE ${next_param} OR r.grade_number IS NULL)"
        params.append(grade)
        next_param += 1
    else:
        grade_clause = f"(r.grade_number BETWEEN ${next_param} AND ${next_param + 1} OR r.grade_number IS NULL)"
        params.extend([requested_number - 1, requested_number + 1])
        next_param += 2

    # Resources seeded before `embedding_model` existed default to OpenAI's
    # model name — same rule as the Node implementation it replaces.
    if embedding_model == "text-embedding-3-small":
        model_clause = f"(rc.embedding_model = ${next_param} OR rc.embedding_model IS NULL)"
    else:
        model_clause = f"rc.embedding_model = ${next_param}"
    params.append(embedding_model)

    sql = f"""
        SELECT rc.text AS text,
               1 - (rc.embedding <=> $1::vector) AS similarity,
               r.title AS title, r.subject AS subject, r.grade AS grade
        FROM resource_chunks rc
        JOIN resources r ON r.id = rc.resource_id
        WHERE r.subject ILIKE $2
          AND {grade_clause}
          AND {model_clause}
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    return [
        RetrievedChunk(
            text=row["text"],
            similarity=float(row["similarity"]),
            source={"title": row["title"], "subject": row["subject"], "grade": row["grade"]},
        )
        for row in rows
    ]


async def retrieve_context(
    pool: asyncpg.Pool,
    *,
    topic: str,
    subject: str,
    grade: str,
    embedding_model: str,
    k: int = 5,
    min_similarity: float,
    mode: Mode = "vector",
    query_embedding: list[float],
) -> list[RetrievedChunk]:
    """
    `query_embedding` is always required here — the caller (the /rag/retrieve
    route) either embeds `topic subject grade` itself or accepts one injected
    by a caller that already holds it (the retrieval eval, which embeds each
    golden query once and shares it across modes).
    """
    candidates = await _fetch_candidates(pool, query_embedding, subject, grade, embedding_model)

    if mode == "hybrid":
        lexical = bm25_scores(topic, [c.text for c in candidates])
        for c, score in zip(candidates, lexical):
            c.lexical = score
        ranked = _rank_hybrid(candidates, min_similarity)
    else:
        ranked = sorted(
            (c for c in candidates if c.similarity >= min_similarity),
            key=lambda c: c.similarity,
            reverse=True,
        )

    return ranked[:k]


class PgVectorResourceRetriever(BaseRetriever):
    """
    LangChain retriever wrapping the query above — the "LangChain retriever"
    step between pgvector and an LLM chain. Deliberately not
    langchain_postgres.PGVector: that store owns its own table shape and
    metadata-JSON filtering convention, which does not match resource_chunks'
    actual columns (subject/grade_number prefilter, embedding_model
    stamping) without either reshaping the schema or re-deriving the same SQL
    this module already has — i.e. a second vector-search implementation.
    This retriever is the thin LangChain-facing wrapper around the one real
    implementation, not an alternative to it.
    """

    model_config = {"arbitrary_types_allowed": True}

    pool: asyncpg.Pool
    embedding_model: str
    subject: str
    grade: str
    k: int = 5
    min_similarity: float
    mode: Mode = "vector"

    async def _aget_relevant_documents(
        self, query: str, *, run_manager: AsyncCallbackManagerForRetrieverRun
    ) -> list[Document]:
        from .embeddings import embed_text  # local import: avoids a hard dependency for callers that inject their own vector

        chunks = await retrieve_context(
            self.pool,
            topic=query,
            subject=self.subject,
            grade=self.grade,
            embedding_model=self.embedding_model,
            k=self.k,
            min_similarity=self.min_similarity,
            mode=self.mode,
            query_embedding=await embed_text(f"{query} {self.subject} {self.grade}"),
        )
        return [
            Document(
                page_content=c.text,
                metadata={**c.source, "similarity": c.similarity, "lexical": c.lexical},
            )
            for c in chunks
        ]

    def _get_relevant_documents(self, query: str, *, run_manager) -> list[Document]:
        raise NotImplementedError("Use the async retriever (_aget_relevant_documents) — this service is async-only.")
