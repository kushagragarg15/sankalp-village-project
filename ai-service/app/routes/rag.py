from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..config import Settings, get_settings
from ..internal_auth import InternalUser, require_internal_auth
from ..llm import resolve_llm_config
from ..rag.embeddings import EmbeddingsNotConfigured, embed_text
from ..rag.generation import generate_lesson_plan
from ..rag.ingest import IngestNotConfigured, ingest_resource
from ..rag.retriever import retrieve_context

router = APIRouter(prefix="/rag", tags=["rag"])


def _pool(request: Request):
    return request.app.state.pool


class EmbedRequest(BaseModel):
    text: str


@router.post("/embed")
async def embed(body: EmbedRequest, user: InternalUser = Depends(require_internal_auth)):
    """
    Used by the retrieval eval to embed each golden query once and share it
    across modes (vector vs hybrid), same reasoning as the Node eval script
    that used to call `embedText` directly.
    """
    try:
        vector = await embed_text(body.text)
    except EmbeddingsNotConfigured as err:
        raise HTTPException(status_code=503, detail=str(err)) from err
    return {"embedding": vector}


class RetrieveRequest(BaseModel):
    topic: str
    subject: str
    grade: str
    k: int = 5
    min_similarity: Optional[float] = None
    mode: Optional[Literal["vector", "hybrid"]] = None
    # Callers that already hold the query vector (the eval harness) can pass
    # it in, bypassing this service's own embed call — same override
    # `retrieveContext` accepted in Node.
    query_embedding: Optional[list[float]] = None


@router.post("/retrieve")
async def retrieve(
    body: RetrieveRequest,
    request: Request,
    user: InternalUser = Depends(require_internal_auth),
    settings: Settings = Depends(get_settings),
):
    config = resolve_llm_config(settings)
    if not config:
        raise HTTPException(status_code=503, detail="No embedding provider configured.")

    query_embedding = body.query_embedding
    if query_embedding is None:
        query_embedding = await embed_text(f"{body.topic} {body.subject} {body.grade}")

    min_similarity = body.min_similarity if body.min_similarity is not None else (
        settings.rag_similarity_threshold or config.similarity_threshold
    )
    mode = body.mode or settings.retrieval_mode

    chunks = await retrieve_context(
        _pool(request),
        topic=body.topic,
        subject=body.subject,
        grade=body.grade,
        embedding_model=config.embedding_model,
        k=body.k,
        min_similarity=min_similarity,
        mode=mode,
        query_embedding=query_embedding,
    )

    return {
        "chunks": [
            {"text": c.text, "similarity": c.similarity, "lexical": c.lexical, "source": c.source}
            for c in chunks
        ]
    }


class LessonPlanRequest(BaseModel):
    topic: str
    subject: str
    grade: str
    extra_instructions: str = ""
    k: int = 5


@router.post("/lesson-plan")
async def lesson_plan(body: LessonPlanRequest, user: InternalUser = Depends(require_internal_auth)):
    """
    The full RAG lesson-plan pipeline — retrieve then generate — used by both
    Node's POST /api/ai/generate-notes and the draft_lesson_plan tool. The
    only place this project generates a lesson plan.
    """
    return await generate_lesson_plan(
        topic=body.topic, subject=body.subject, grade=body.grade, extra_instructions=body.extra_instructions, k=body.k
    )


class ResourceRequest(BaseModel):
    title: str
    subject: str
    grade: str
    content: str = Field(min_length=1)


@router.post("/resources")
async def create_resource(
    body: ResourceRequest,
    request: Request,
    user: InternalUser = Depends(require_internal_auth),
):
    # Same role gate as the Node route it replaces (`authorize('admin')` on
    # POST /api/ai/resources) — Node already checked this before proxying,
    # this is defence in depth, same pattern as the agent's tool re-check.
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        result = await ingest_resource(
            _pool(request),
            title=body.title,
            subject=body.subject,
            grade=body.grade,
            content=body.content,
            created_by=user.id,
        )
    except IngestNotConfigured as err:
        raise HTTPException(status_code=503, detail=str(err)) from err

    return result
