"""Exact port of persistRun from server/services/agentService.js."""

import json
import logging

import asyncpg

logger = logging.getLogger(__name__)


async def persist_run(
    pool: asyncpg.Pool,
    *,
    user,
    conversation_id: str,
    question: str,
    answer: str,
    status: str,
    model: str,
    iterations: int,
    prompt_tokens: int,
    completion_tokens: int,
    steps: list[dict],
    duration_ms: int,
    llm_ms: int,
    error: str = "",
) -> str | None:
    """
    The trace is an audit log, not part of the answer — a failure to write it
    must not turn a good answer into an error for the user, so this never
    raises.
    """
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                run_id = await conn.fetchval(
                    """
                    INSERT INTO agent_runs
                        (user_id, conversation_id, role, question, answer, status, model,
                         iterations, duration_ms, llm_ms, prompt_tokens, completion_tokens, error)
                    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    RETURNING id
                    """,
                    user.id,
                    conversation_id,
                    user.role,
                    question,
                    answer,
                    status,
                    model,
                    iterations,
                    duration_ms,
                    llm_ms,
                    prompt_tokens,
                    completion_tokens,
                    error,
                )

                if steps:
                    await conn.executemany(
                        """
                        INSERT INTO agent_run_steps
                            (run_id, iteration, tool, args, ok, duration_ms, result_preview, error)
                        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
                        """,
                        [
                            (
                                run_id,
                                s.get("iteration"),
                                s.get("tool"),
                                json.dumps(s.get("args")) if s.get("args") is not None else None,
                                s.get("ok"),
                                s.get("duration_ms"),
                                s.get("result_preview"),
                                s.get("error"),
                            )
                            for s in steps
                        ],
                    )
        return str(run_id)
    except Exception as err:  # noqa: BLE001 — audit-log write, must never break the response
        logger.error("Could not persist agent run: %s", err)
        return None
