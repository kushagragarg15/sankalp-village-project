import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..agent.runner import run_agent, run_agent_stream
from ..internal_auth import InternalUser, require_internal_auth

router = APIRouter(prefix="/agent", tags=["agent"])


class AskRequest(BaseModel):
    question: Optional[str] = None
    conversationId: Optional[str] = None
    # Legacy: a full client-sent transcript. Node's own validation is the
    # real gate here (this service trusts its one caller); this is just a
    # sanity check against a malformed direct call.
    messages: Optional[list[dict]] = None


def _validate(body: AskRequest) -> None:
    if not (body.question and body.question.strip()) and not body.messages:
        raise HTTPException(status_code=400, detail="Send question (optionally with conversationId), or messages")


@router.post("/ask")
async def ask(body: AskRequest, user: InternalUser = Depends(require_internal_auth)):
    _validate(body)
    return await run_agent(
        question=body.question, conversation_id=body.conversationId, messages=body.messages, user=user
    )


@router.post("/ask/stream")
async def ask_stream(body: AskRequest, user: InternalUser = Depends(require_internal_auth)):
    _validate(body)

    async def event_source():
        async for event in run_agent_stream(
            question=body.question, conversation_id=body.conversationId, messages=body.messages, user=user
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
