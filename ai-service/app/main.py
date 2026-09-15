import math
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import check_health, create_pool
from .errors import ProviderError
from .internal_auth import InternalUser, require_internal_auth
from .routes.agent import router as agent_router
from .routes.rag import router as rag_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await create_pool(settings)
    try:
        yield
    finally:
        await app.state.pool.close()


app = FastAPI(title="Sankalp AI Service", lifespan=lifespan)
app.include_router(rag_router)
app.include_router(agent_router)


@app.middleware("http")
async def correlation_id(request: Request, call_next):
    # Node mints one per request (see aiServiceClient.js) so a failure can be
    # traced across the Node -> Python hop; generate one if a caller omits it
    # (curl, the health probe) rather than leaving requests untagged.
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response


@app.exception_handler(ProviderError)
async def provider_error_handler(request: Request, exc: ProviderError):
    status = 429 if exc.code in ("rate_limited", "no_credits") else 503
    headers = {}
    if exc.retry_after_ms:
        headers["Retry-After"] = str(math.ceil(exc.retry_after_ms / 1000))
    return JSONResponse(status_code=status, content=exc.to_dict(), headers=headers)


@app.get("/health")
async def health():
    """
    Public, unauthenticated — an infra/uptime probe, not a data endpoint.
    Reports the same two things server/db/pool.js's connectPG() checks:
    that PostgreSQL is reachable, and that pgvector is installed.
    """
    try:
        db_status = await check_health(app.state.pool)
    except Exception as err:  # noqa: BLE001 — health check reports, never crashes
        return {"status": "error", "database": {"connected": False, "error": str(err)}}

    status = "ok" if db_status["pgvector"] else "degraded"
    return {"status": status, "database": db_status}


@app.get("/internal/whoami")
async def whoami(user: InternalUser = Depends(require_internal_auth)):
    """
    Smallest possible proof the Node -> Python auth hop works: echoes back
    the trusted user context Node sent, same idea as the MCP server's
    `sankalp://whoami` resource.
    """
    return {"id": user.id, "role": user.role, "name": user.name}
