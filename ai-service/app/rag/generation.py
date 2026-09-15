"""
Port of generateLessonPlan from server/services/ragService.js: retrieve
(app/rag/retriever.py) then generate (app/rag/chat.py) — same prompt, same
temperature/max_tokens, same source-shaping, so a plan reads identically
regardless of which language produced it.
"""

from langchain_core.messages import HumanMessage, SystemMessage

from ..config import get_settings
from ..db import get_pool
from ..llm import resolve_llm_config
from .chat import ChatNotConfigured, chat_with_retry
from .embeddings import embed_text
from .retriever import retrieve_context

SYSTEM_MESSAGE = (
    "You are an experienced teacher helping volunteers plan lessons for a one-room village "
    "classroom. Assume there are NO printed materials of any kind — no worksheets, printouts, "
    "photocopies or printed copies of texts — only chalk, a board, and everyday objects (stones, "
    "sticks, rotis, leaves). If a text is needed, the volunteer reads it aloud or writes it on the "
    "board. Use the provided teaching resources to ground your lesson plan in proven teaching "
    "strategies."
)


def _user_prompt(topic: str, subject: str, grade: str, extra_instructions: str, chunks: list) -> str:
    if chunks:
        context_section = "\n\nRELEVANT TEACHING RESOURCES:\n\n"
        for idx, chunk in enumerate(chunks):
            context_section += f"[Resource {idx + 1}: {chunk.source['title']}]\n{chunk.text}\n\n"
    else:
        context_section = "\n\nNote: No specific teaching resources found for this exact topic. Generate from general teaching knowledge.\n\n"

    extra = f"Additional Instructions: {extra_instructions}\n" if extra_instructions else ""
    return f"""{context_section}
Based on the teaching resources above, create a structured lesson plan for:

Topic: {topic}
Subject: {subject}
Grade: {grade}
{extra}
Please provide:
1. Learning Objective (1-2 sentences)
2. Key Concepts (3-4 bullet points)
3. Simple Explanation (suitable for the grade level, in 2-3 paragraphs)
4. Activity Idea (one hands-on activity that requires minimal materials)
5. Three Quiz Questions (with answers)

Format the response in a clear, structured way that a volunteer can easily follow."""


async def generate_lesson_plan(
    *, topic: str, subject: str, grade: str, extra_instructions: str = "", k: int = 5
) -> dict:
    settings = get_settings()
    config = resolve_llm_config(settings)
    if not config:
        raise ChatNotConfigured("No chat/embedding provider configured.")

    query_embedding = await embed_text(f"{topic} {subject} {grade}")
    chunks = await retrieve_context(
        get_pool(),
        topic=topic,
        subject=subject,
        grade=grade,
        embedding_model=config.embedding_model,
        k=k,
        min_similarity=settings.rag_similarity_threshold or config.similarity_threshold,
        mode=settings.retrieval_mode,
        query_embedding=query_embedding,
    )

    user_prompt = _user_prompt(topic, subject, grade, extra_instructions, chunks)

    response = await chat_with_retry(
        [SystemMessage(content=SYSTEM_MESSAGE), HumanMessage(content=user_prompt)],
        temperature=0.7,
        max_tokens=1500,
    )
    lesson_plan = response.content

    sources = [
        {
            "type": "resource",
            "label": f"{c.source['title']} ({c.source['grade']} {c.source['subject']})",
            "snippet": c.text[:150] + ("..." if len(c.text) > 150 else ""),
            "similarity": f"{c.similarity:.3f}",
        }
        for c in chunks
    ]

    return {
        "lessonPlan": lesson_plan,
        "sources": sources,
        "contextChunks": [{"title": c.source["title"], "text": c.text} for c in chunks],
    }
