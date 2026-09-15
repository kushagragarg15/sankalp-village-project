"""
Port of get_volunteer_stats from server/services/agentTools.js.

Admin-only — like the Node version, this tool does not check the caller's
role itself; that gate is external (`tools_for_role`, mirroring
`toolsForRole`/`executeToolCall`'s re-check in agentService.js). Whoever
wires this into a request path must apply the same two-gate discipline the
Node agent loop does: don't tell the model this tool exists unless the
caller is an admin, and don't run it if the model names it anyway.
"""

from typing import Optional

from langchain_core.tools import tool

from ..db import get_pool
from .common import days_ago


@tool
async def get_volunteer_stats(name: Optional[str] = None, days: int = 30, limit: int = 10) -> dict:
    """Coordinator view of volunteers: a leaderboard of lessons taught in a period, or one
    volunteer's activity by name. Use for "who taught the most", "has Rahul been active",
    "which volunteers went quiet".

    name: a specific volunteer; omit for the leaderboard.
    days: look-back window in days (default 30).
    limit: leaderboard size (default 10, max 25)."""
    pool = get_pool()
    since = days_ago(days)

    async with pool.acquire() as conn:
        volunteers = await (
            conn.fetch("SELECT id, name FROM users WHERE role = 'volunteer' AND name ILIKE $1", f"%{name}%")
            if name
            else conn.fetch("SELECT id, name FROM users WHERE role = 'volunteer'")
        )
        if not volunteers:
            return {"volunteers": [], "message": "No volunteers match."}

        ids = [v["id"] for v in volunteers]
        stats = await conn.fetch(
            """
            SELECT volunteer_id, COUNT(*)::int AS lessons,
                   COUNT(DISTINCT student_id)::int AS students,
                   COUNT(DISTINCT session_id)::int AS sessions,
                   MAX(logged_at) AS last_taught
            FROM teaching_logs
            WHERE volunteer_id = ANY($1::uuid[]) AND logged_at >= $2
            GROUP BY volunteer_id
            """,
            ids,
            since,
        )

    by_id = {s["volunteer_id"]: s for s in stats}
    rows = sorted(
        (
            {
                "name": v["name"],
                "lessons": (by_id.get(v["id"]) or {}).get("lessons", 0),
                "distinctStudents": (by_id.get(v["id"]) or {}).get("students", 0),
                "sessionsTaught": (by_id.get(v["id"]) or {}).get("sessions", 0),
                "lastTaught": (by_id.get(v["id"]) or {}).get("last_taught"),
            }
            for v in volunteers
        ),
        key=lambda r: r["lessons"],
        reverse=True,
    )

    return {
        "periodDays": days,
        "totalVolunteers": len(volunteers),
        "inactiveInPeriod": sum(1 for r in rows if r["lessons"] == 0),
        "volunteers": rows[: min(max(limit, 1), 25)],
    }
