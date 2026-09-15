"""
Resource ingestion: chunk -> embed -> store. Mirrors what
server/controllers/aiController.js `createResource` and
server/scripts/seedResources.js used to do directly against Postgres; both
now call POST /rag/resources instead, so this is the only place a resource's
chunks and embeddings are written.
"""

import asyncpg

from ..config import Settings, get_settings
from ..llm import resolve_llm_config
from .chunking import chunk_text
from .embeddings import embed_texts
from .retriever import parse_grade_number


class IngestNotConfigured(RuntimeError):
    pass


async def ingest_resource(
    pool: asyncpg.Pool,
    *,
    title: str,
    subject: str,
    grade: str,
    content: str,
    created_by: str | None = None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    config = resolve_llm_config(settings)
    if not config:
        raise IngestNotConfigured("No embedding provider configured.")

    chunks = chunk_text(content)
    vectors = await embed_texts(chunks) if chunks else []

    async with pool.acquire() as conn:
        async with conn.transaction():
            resource_id = await conn.fetchval(
                """
                INSERT INTO resources (title, subject, grade, grade_number, content, embedding_model, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
                """,
                title,
                subject,
                grade,
                parse_grade_number(grade),
                content,
                config.embedding_model,
                created_by,
            )

            if chunks:
                await conn.executemany(
                    """
                    INSERT INTO resource_chunks (resource_id, chunk_index, text, embedding, embedding_model)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    [
                        (resource_id, index, text, vector, config.embedding_model)
                        for index, (text, vector) in enumerate(zip(chunks, vectors))
                    ],
                )

    return {
        "id": str(resource_id),
        "title": title,
        "subject": subject,
        "grade": grade,
        "embeddingModel": config.embedding_model,
        "chunks": len(chunks),
    }
