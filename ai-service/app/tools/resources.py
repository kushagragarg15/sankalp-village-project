"""
Port of the RAG-backed tools in server/services/agentTools.js:
search_teaching_resources, draft_lesson_plan. Both call straight into
app/rag/ — the same retrieval and generation code the /rag/* HTTP routes use
— so there is exactly one RAG implementation, not a tool-specific copy.
"""

from typing import Optional

from langchain_core.tools import tool

from ..config import get_settings
from ..db import get_pool
from ..llm import resolve_llm_config
from ..rag.embeddings import embed_text
from ..rag.generation import generate_lesson_plan
from ..rag.retriever import retrieve_context
from .common import normalise_subject


@tool
async def search_teaching_resources(topic: str, subject: str, grade: str) -> dict:
    """Search the club's curated library of teaching resources by topic, subject and class.
    Returns the most relevant passages with similarity scores. Use this when asked how to
    teach something, for activity ideas, or for what material the club has on a topic."""
    settings = get_settings()
    config = resolve_llm_config(settings)
    subject = normalise_subject(subject)

    query_embedding = await embed_text(f"{topic} {subject} {grade}")
    chunks = await retrieve_context(
        get_pool(),
        topic=topic,
        subject=subject,
        grade=grade,
        embedding_model=config.embedding_model,
        k=4,
        min_similarity=settings.rag_similarity_threshold or config.similarity_threshold,
        mode=settings.retrieval_mode,
        query_embedding=query_embedding,
    )

    return {
        "matches": len(chunks),
        "passages": [
            {"source": c.source["title"], "similarity": round(c.similarity, 3), "text": c.text[:600]}
            for c in chunks
        ],
    }


@tool
async def draft_lesson_plan(topic: str, subject: str, grade: str, extra_instructions: Optional[str] = None) -> dict:
    """Generate a full structured lesson plan (objective, key concepts, explanation, activity,
    quiz) grounded in the club's teaching resources. Slow and expensive — only call it when
    the user explicitly asks for a plan, not for a quick question.

    grade: e.g. "Class 4".
    extra_instructions: optional constraints, e.g. "no printed sheets", "mixed ability group"."""
    result = await generate_lesson_plan(
        topic=topic, subject=normalise_subject(subject), grade=grade, extra_instructions=extra_instructions or ""
    )
    return {"lessonPlan": result["lessonPlan"], "sources": [s["label"] for s in result["sources"]]}
