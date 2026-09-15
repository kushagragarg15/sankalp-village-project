from functools import lru_cache
from typing import Literal, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    One place that knows about this service's configuration — same reasoning
    as server/services/llmClient.js being the one place Node knows about LLM
    providers. Env var names match the Node service's where the same value is
    meant (DATABASE_URL, DATABASE_SSL, LLM_PROVIDER, ...), so a single .env
    can be shared/copied across both without renaming anything.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    port: int = 8000
    environment: str = "development"

    # PostgreSQL — the same database server.js's Drizzle pool connects to.
    database_url: str
    database_ssl: bool = True
    db_pool_min_size: int = 2
    db_pool_max_size: int = 10

    # Shared secret for the Node -> Python hop. Node resolves the browser JWT
    # into a trusted { id, role, name } and sends it in headers alongside this
    # token; this service never interprets a browser JWT itself. See
    # app/internal_auth.py.
    ai_service_token: str

    # LLM provider selection — foundation only, not wired to any client yet.
    # Names match server/services/llmClient.js exactly.
    llm_provider: Optional[Literal["groq", "gemini", "openai"]] = None
    embedding_provider: Optional[Literal["gemini", "openai"]] = None
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    llm_chat_model: Optional[str] = None
    llm_embedding_model: Optional[str] = None

    # resource_chunks.embedding is vector(3072) — verified against the actual
    # stored data (gemini-embedding-001) when the PostgreSQL schema was built.
    embedding_dimensions: int = 3072

    # 'vector' ranks by cosine similarity alone; 'hybrid' adds BM25 (see
    # app/rag/lexical.py). Same env var name and default as the Node
    # implementation this replaces — do not switch without re-running the
    # retrieval eval.
    retrieval_mode: Literal["vector", "hybrid"] = "vector"
    rag_similarity_threshold: Optional[float] = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
