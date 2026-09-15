"""
Embedding generation — the one place this service calls an embedding model,
mirroring server/services/embeddingService.js's role on the Node side (now
retired there). Uses LangChain's OpenAIEmbeddings against whichever
OpenAI-compatible endpoint app/llm.py resolves (Gemini's or OpenAI's) — this
is where LangChain genuinely simplifies things (batching, retries) versus a
hand-rolled HTTP client.
"""

from functools import lru_cache

from langchain_openai import OpenAIEmbeddings

from ..config import get_settings
from ..llm import PROVIDERS, resolve_llm_config


class EmbeddingsNotConfigured(RuntimeError):
    pass


@lru_cache
def get_embeddings_client() -> OpenAIEmbeddings:
    settings = get_settings()
    config = resolve_llm_config(settings)
    if not config:
        raise EmbeddingsNotConfigured(
            "No embedding provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY."
        )

    provider_info = PROVIDERS[config.embedding_provider]
    api_key = getattr(settings, provider_info.api_key_env.lower())
    if not api_key:
        raise EmbeddingsNotConfigured(f"{provider_info.api_key_env} not configured")

    return OpenAIEmbeddings(
        model=config.embedding_model,
        api_key=api_key,
        base_url=provider_info.base_url,
        # Gemini/other OpenAI-compatible models are not real OpenAI models —
        # tiktoken-based context-length checking would fail to resolve them.
        check_embedding_ctx_length=False,
        tiktoken_enabled=False,
    )


async def embed_text(text: str) -> list[float]:
    client = get_embeddings_client()
    return await client.aembed_query(text)


async def embed_texts(texts: list[str]) -> list[list[float]]:
    client = get_embeddings_client()
    return await client.aembed_documents(texts)
