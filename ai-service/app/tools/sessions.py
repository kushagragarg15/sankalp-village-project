"""Port of list_sessions from server/services/agentTools.js."""

from datetime import datetime, timezone
from typing import Literal

from langchain_core.tools import tool

from ..db import get_pool


@tool
async def list_sessions(range: Literal["live", "upcoming", "past"], limit: int = 5) -> dict:
    """List teaching sessions. "live" = happening right now, "upcoming" = future, "past" =
    already finished. Includes how many volunteers registered and, for past sessions, how
    many lessons were logged. Use for "when is the next session", "what happened last Saturday".

    limit: max sessions to return (default 5, max 20)."""
    n = min(max(limit, 1), 20)
    pool = get_pool()

    if range == "live":
        where_sql, order_sql = "start_time <= now() AND end_time >= now()", "start_time ASC"
    elif range == "upcoming":
        where_sql, order_sql = "start_time > now()", "start_time ASC"
    else:
        where_sql, order_sql = "end_time < now()", "start_time DESC"

    async with pool.acquire() as conn:
        sessions = await conn.fetch(
            f"SELECT id, title, start_time, end_time FROM attendance_sessions WHERE {where_sql} ORDER BY {order_sql} LIMIT $1",
            n,
        )
        if not sessions:
            return {"sessions": []}

        ids = [s["id"] for s in sessions]
        regs = await conn.fetch(
            "SELECT session_id, COUNT(*)::int AS count FROM registrations WHERE session_id = ANY($1::uuid[]) GROUP BY session_id",
            ids,
        )
        logs = await conn.fetch(
            """
            SELECT session_id, COUNT(*)::int AS lessons,
                   COUNT(DISTINCT student_id)::int AS students,
                   COUNT(DISTINCT volunteer_id)::int AS volunteers
            FROM teaching_logs WHERE session_id = ANY($1::uuid[]) GROUP BY session_id
            """,
            ids,
        )

    reg_by_id = {r["session_id"]: r["count"] for r in regs}
    log_by_id = {l["session_id"]: l for l in logs}

    return {
        "now": datetime.now(timezone.utc),
        "sessions": [
            {
                "title": s["title"],
                "startTime": s["start_time"],
                "endTime": s["end_time"],
                "volunteersRegistered": reg_by_id.get(s["id"], 0),
                "lessonsLogged": (log_by_id.get(s["id"]) or {}).get("lessons", 0),
                "studentsTaught": (log_by_id.get(s["id"]) or {}).get("students", 0),
                "volunteersWhoTaught": (log_by_id.get(s["id"]) or {}).get("volunteers", 0),
            }
            for s in sessions
        ],
    }
