import ssl

import asyncpg
from pgvector.asyncpg import register_vector

from .config import Settings


async def _init_connection(conn: asyncpg.Connection) -> None:
    # Lets asyncpg encode/decode `vector` columns as Python lists of floats
    # directly, the same way drizzle-orm's `vector` column type does on the
    # Node side — no manual "[1,2,3]" string building.
    await register_vector(conn)


_pool: asyncpg.Pool | None = None


async def create_pool(settings: Settings) -> asyncpg.Pool:
    global _pool
    ssl_context: bool | ssl.SSLContext
    if settings.database_ssl:
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
    else:
        ssl_context = False

    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=settings.db_pool_min_size,
        max_size=settings.db_pool_max_size,
        ssl=ssl_context,
        init=_init_connection,
        # Fail fast rather than hanging — same reasoning as server/db/pool.js.
        timeout=8,
        command_timeout=30,
        # Statement caching assumes a stable session per connection, which
        # breaks behind a transaction-mode pooler (PgBouncer and similar) —
        # asyncpg's own advice is to disable it rather than risk a
        # DuplicatePreparedStatementError from a reused statement name.
        statement_cache_size=0,
    )
    return _pool


def get_pool() -> asyncpg.Pool:
    """
    Ambient access to the one pool, for callers that aren't inside a FastAPI
    request (agent tools, called directly the way sessionPrepService.js calls
    Node's tool.run() outside any HTTP request) — same reasoning as Node's
    `getDb()` module-level singleton.
    """
    if _pool is None:
        raise RuntimeError("Database pool not initialised — call create_pool() first.")
    return _pool


async def check_health(pool: asyncpg.Pool) -> dict:
    async with pool.acquire() as conn:
        db_name = await conn.fetchval("SELECT current_database()")
        pgvector_installed = await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')"
        )
    return {"connected": True, "database": db_name, "pgvector": bool(pgvector_installed)}
