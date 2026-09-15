"""
Public entry points — the Python equivalent of `runAgent` in
server/services/agentService.js. One function serves both the plain and the
streaming path, exactly like the Node version: `run_agent(..., on_event=...)`
for streaming, `run_agent(...)` without it for a single awaited result.
"""

import asyncio
import time
import uuid
from typing import Any, Callable, Optional

from langchain_core.messages import AIMessage, SystemMessage
from langgraph.errors import GraphRecursionError

from ..config import get_settings
from ..db import get_pool
from ..errors import ProviderError
from ..internal_auth import InternalUser
from ..llm import resolve_llm_config
from ..rag.chat import get_chat_client
from ..tools import tools_for_user
from .graph import AGENT_GRAPH, CANNED_MAX_ITERATIONS_MESSAGE, MAX_ITERATIONS, MAX_OUTPUT_TOKENS, TEMPERATURE
from .history import load_conversation, sanitise_history, to_lc_messages
from .persistence import persist_run
from .prompt import build_system_prompt

RECURSION_LIMIT = MAX_ITERATIONS * 2 + 4  # 2 graph steps/iteration, generous headroom


def _step_for_response(step: dict) -> dict:
    # Steps are built once (graph.py) and used two ways: persist_run() wants
    # `duration_ms` (matches the agent_run_steps column), the API response —
    # and the client Trace component — wants `durationMs`, matching every
    # other camelCase field in this payload (and the Node agent it replaces).
    # The `result_preview` is for the audit log only, never the response.
    return {
        "iteration": step.get("iteration"),
        "tool": step.get("tool"),
        "args": step.get("args"),
        "ok": step.get("ok"),
        "durationMs": step.get("duration_ms"),
        "error": step.get("error"),
    }


async def run_agent(
    *,
    question: Optional[str] = None,
    conversation_id: Optional[str] = None,
    messages: Optional[list[dict]] = None,
    user: InternalUser,
    on_event: Optional[Callable[[dict], Any]] = None,
) -> dict:
    started = time.monotonic()
    conversation_id = str(conversation_id) if conversation_id else str(uuid.uuid4())
    pool = get_pool()

    settings = get_settings()
    config_llm = resolve_llm_config(settings)
    model_name = config_llm.chat_model if config_llm else "unknown"

    # Server-owned history when a question is given; a client transcript only
    # for callers that still send one.
    if question:
        history = sanitise_history(
            [*(await load_conversation(pool, user.id, conversation_id)), {"role": "user", "content": str(question)}]
        )
    else:
        history = sanitise_history(messages or [])
    question_text = history[-1]["content"] if history else ""

    tools = tools_for_user(user.role, user.id, user.name)
    allowed_tools = {t.name: t for t in tools}
    bound_model = get_chat_client().bind_tools(tools, tool_choice="auto").bind(
        temperature=TEMPERATURE, max_tokens=MAX_OUTPUT_TOKENS
    )

    lc_messages = [SystemMessage(content=build_system_prompt(user)), *to_lc_messages(history)]
    initial_state = {
        "messages": lc_messages,
        "iterations": 0,
        "steps": [],
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "llm_ms": 0,
        "status": "",
    }
    graph_config = {
        "configurable": {"bound_model": bound_model, "allowed_tools": allowed_tools, "on_event": on_event},
        "recursion_limit": RECURSION_LIMIT,
    }

    try:
        final_state = await AGENT_GRAPH.ainvoke(initial_state, config=graph_config)
    except GraphRecursionError:
        # Defence in depth only — agent_node's own iteration check (see
        # graph.py) should always stop the loop first. If LangGraph's own
        # step count ever wins the race, produce the same graceful answer.
        final_state = {
            **initial_state,
            "status": "max_iterations",
            "messages": [*lc_messages, AIMessage(content=CANNED_MAX_ITERATIONS_MESSAGE)],
            "iterations": MAX_ITERATIONS,
        }
    except Exception as err:
        await persist_run(
            pool,
            user=user,
            conversation_id=conversation_id,
            question=question_text,
            answer="",
            status="error",
            model=model_name,
            iterations=0,
            prompt_tokens=0,
            completion_tokens=0,
            steps=[],
            duration_ms=int((time.monotonic() - started) * 1000),
            llm_ms=0,
            error=str(err),
        )
        raise

    answer = final_state["messages"][-1].content or ""
    status = final_state.get("status") or "completed"
    duration_ms = int((time.monotonic() - started) * 1000)

    run_id = await persist_run(
        pool,
        user=user,
        conversation_id=conversation_id,
        question=question_text,
        answer=answer,
        status=status,
        model=model_name,
        iterations=final_state["iterations"],
        prompt_tokens=final_state["prompt_tokens"],
        completion_tokens=final_state["completion_tokens"],
        steps=final_state["steps"],
        duration_ms=duration_ms,
        llm_ms=final_state["llm_ms"],
    )

    return {
        "conversationId": conversation_id,
        "answer": answer,
        "steps": [_step_for_response(s) for s in final_state["steps"]],
        "iterations": final_state["iterations"],
        "usage": {"promptTokens": final_state["prompt_tokens"], "completionTokens": final_state["completion_tokens"]},
        "durationMs": duration_ms,
        "llmMs": final_state["llm_ms"],
        "status": status,
        "runId": run_id,
    }


async def run_agent_stream(
    *,
    question: Optional[str] = None,
    conversation_id: Optional[str] = None,
    messages: Optional[list[dict]] = None,
    user: InternalUser,
):
    """
    Async generator yielding the SSE event contract the browser already
    consumes: token / retract / tool_start / tool_end, then a final `done`
    (same payload `run_agent` returns) or `error`. Wiring this into an actual
    HTTP route is a separate step — this is the Python-side equivalent of
    Node's `runAgent({ onEvent })`, which `aiController.askAgentStream` wraps.
    """
    queue: asyncio.Queue = asyncio.Queue()
    SENTINEL = object()

    def on_event(event: dict) -> None:
        queue.put_nowait(event)

    async def drive() -> None:
        try:
            result = await run_agent(
                question=question, conversation_id=conversation_id, messages=messages, user=user, on_event=on_event
            )
            queue.put_nowait({"type": "done", **result})
        except Exception as err:  # noqa: BLE001 — surfaced to the stream as an error event, not raised into the generator's caller
            event = {"type": "error", "message": str(err)}
            if isinstance(err, ProviderError):
                event.update(code=err.code, retryAfterMs=err.retry_after_ms)
            queue.put_nowait(event)
        finally:
            queue.put_nowait(SENTINEL)

    task = asyncio.create_task(drive())
    try:
        while True:
            item = await queue.get()
            if item is SENTINEL:
                break
            yield item
    finally:
        await task
