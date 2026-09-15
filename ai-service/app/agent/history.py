"""
Conversation history — exact port of loadConversation/sanitiseHistory from
server/services/agentService.js. Conversation state is NOT a LangGraph
checkpointer; it is rebuilt from `agent_runs` on every call, same as Node.
"""

import asyncpg
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

MAX_HISTORY_MESSAGES = 12
MAX_MESSAGE_CHARS = 2000


async def load_conversation(pool: asyncpg.Pool, user_id: str, conversation_id: str) -> list[dict]:
    """
    One user turn and one assistant turn per completed run, oldest first,
    capped to the same window a client-sent transcript would get. Errored
    runs (no answer) are skipped — the model should not see a question it
    never answered.
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT question, answer FROM agent_runs
            WHERE user_id = $1::uuid AND conversation_id = $2::uuid AND answer <> ''
            ORDER BY created_at DESC
            LIMIT $3
            """,
            user_id,
            conversation_id,
            MAX_HISTORY_MESSAGES // 2,
        )
    pairs: list[dict] = []
    for r in reversed(rows):
        pairs.append({"role": "user", "content": r["question"]})
        pairs.append({"role": "assistant", "content": r["answer"]})
    return pairs


def sanitise_history(messages: list[dict]) -> list[dict]:
    """Only user/assistant turns are accepted — tool messages are ours to add,
    never the caller's."""
    out = []
    for m in messages or []:
        if not m or m.get("role") not in ("user", "assistant") or not isinstance(m.get("content"), str):
            continue
        out.append({"role": m["role"], "content": m["content"][:MAX_MESSAGE_CHARS]})
    return out[-MAX_HISTORY_MESSAGES:]


def to_lc_messages(history: list[dict]) -> list[BaseMessage]:
    return [
        HumanMessage(content=m["content"]) if m["role"] == "user" else AIMessage(content=m["content"])
        for m in history
    ]
