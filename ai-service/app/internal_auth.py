import secrets
from typing import Annotated, Literal
from urllib.parse import unquote

from fastapi import Depends, Header, HTTPException

from .config import Settings, get_settings

ROLES = ("admin", "volunteer")


class InternalUser:
    """
    The trusted user context Node has already resolved from the browser JWT
    (server/middleware/auth.js `protect`) — never re-derived from a token
    this service can see. `id`/`role`/`name` mirror `req.user` in Node.
    """

    __slots__ = ("id", "role", "name")

    def __init__(self, id: str, role: Literal["admin", "volunteer"], name: str):
        self.id = id
        self.role = role
        self.name = name


def require_internal_auth(
    authorization: Annotated[str | None, Header()] = None,
    x_sankalp_user_id: Annotated[str | None, Header()] = None,
    x_sankalp_user_role: Annotated[str | None, Header()] = None,
    x_sankalp_user_name: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> InternalUser:
    """
    Every route that does anything on behalf of a user requires this.

    This service never accepts a browser JWT or a browser-supplied role —
    only Node calls it, over the shared `AI_SERVICE_TOKEN` secret, and Node
    is the one that resolved `req.user` (with its role cache/invalidation)
    before making the call. A caller who only has the browser's JWT, or who
    forges an X-Sankalp-User-* header without the shared secret, gets 401.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing internal service credentials")

    token = authorization.removeprefix("Bearer ").strip()
    if not secrets.compare_digest(token, settings.ai_service_token):
        raise HTTPException(status_code=401, detail="Invalid internal service credentials")

    if not x_sankalp_user_id or not x_sankalp_user_role or not x_sankalp_user_name:
        raise HTTPException(status_code=400, detail="Missing user context headers")

    if x_sankalp_user_role not in ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of: {', '.join(ROLES)}")

    return InternalUser(id=x_sankalp_user_id, role=x_sankalp_user_role, name=unquote(x_sankalp_user_name))
