"""
LLM provider configuration — the Python-side counterpart of
server/services/llmClient.js's provider table. Resolves which provider/model
this service would use for chat and embeddings; does not call any provider
yet (no client, no LangChain) — that lands with the RAG/agent migration.
"""

from dataclasses import dataclass
from typing import Literal, Optional

from .config import Settings

Provider = Literal["groq", "gemini", "openai"]
EmbeddingProvider = Literal["gemini", "openai"]


@dataclass(frozen=True)
class ProviderInfo:
    api_key_env: str
    base_url: Optional[str]
    chat_model: Optional[str]
    embedding_model: Optional[str]
    similarity_threshold: Optional[float]


PROVIDERS: dict[str, ProviderInfo] = {
    "groq": ProviderInfo(
        api_key_env="GROQ_API_KEY",
        base_url="https://api.groq.com/openai/v1",
        chat_model="openai/gpt-oss-120b",
        embedding_model=None,
        similarity_threshold=None,
    ),
    "gemini": ProviderInfo(
        api_key_env="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        chat_model="gemini-3.5-flash",
        embedding_model="gemini-embedding-001",
        similarity_threshold=0.62,
    ),
    "openai": ProviderInfo(
        api_key_env="OPENAI_API_KEY",
        base_url=None,
        chat_model="gpt-4o-mini",
        embedding_model="text-embedding-3-small",
        similarity_threshold=0.75,
    ),
}

EMBEDDING_CAPABLE: tuple[EmbeddingProvider, ...] = ("gemini", "openai")


@dataclass(frozen=True)
class ResolvedLLMConfig:
    chat_provider: Provider
    embedding_provider: EmbeddingProvider
    chat_model: str
    embedding_model: str
    similarity_threshold: float


def _has_key(settings: Settings, provider: str) -> bool:
    return bool(getattr(settings, PROVIDERS[provider].api_key_env.lower()))


def resolve_llm_config(settings: Settings) -> Optional[ResolvedLLMConfig]:
    """Returns None when no provider has a key configured — the AI features
    are optional, same as on the Node side."""
    chat_candidates: tuple[Provider, ...] = ("groq", "gemini", "openai")
    chat_provider = settings.llm_provider or next((p for p in chat_candidates if _has_key(settings, p)), None)
    if not chat_provider:
        return None

    if settings.embedding_provider:
        embedding_provider = settings.embedding_provider
    elif chat_provider in EMBEDDING_CAPABLE:
        embedding_provider = chat_provider  # type: ignore[assignment]
    else:
        embedding_provider = next((p for p in EMBEDDING_CAPABLE if _has_key(settings, p)), EMBEDDING_CAPABLE[0])

    chat_info = PROVIDERS[chat_provider]
    embedding_info = PROVIDERS[embedding_provider]

    return ResolvedLLMConfig(
        chat_provider=chat_provider,
        embedding_provider=embedding_provider,
        chat_model=settings.llm_chat_model or chat_info.chat_model,
        embedding_model=settings.llm_embedding_model or embedding_info.embedding_model,
        similarity_threshold=embedding_info.similarity_threshold or 0.7,
    )
