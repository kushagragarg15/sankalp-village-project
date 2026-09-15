"""
Port of get_my_teaching_history from server/services/agentTools.js.

Always scoped to the Node-supplied, already-authenticated user — `volunteer_id`
is bound in `make_get_my_teaching_history` from the trusted internal-auth
context (see app/internal_auth.py), never taken as a tool argument, so an LLM
has no parameter through which to ask for anyone else's history. This is the
same guarantee the JS version gives by reading `ctx.user.id` instead of
anything in the model-supplied `args` object — `ctx` was never part of the
tool's JSON Schema, and this factory's closure plays the identical role.
"""

from typing import Optional

from langchain_core.tools import tool

from ..db import get_pool
from .common import days_since, quiz_average


def make_get_my_teaching_history(volunteer_id: str, volunteer_name: str):
    @tool("get_my_teaching_history")
    async def get_my_teaching_history(limit: int = 15) -> dict:
        """The signed-in user's own teaching record: totals, their most recent lessons, AND a
        per-student summary (what I taught each child, when I last saw them, their quiz average).
        Use for "what did I teach last time", "who have I been teaching", "what should I revise
        with my students". It already answers the per-student question — no further lookups needed.

        limit: recent lessons to include (default 15, max 40)."""
        n = min(max(limit, 1), 40)
        pool = get_pool()

        async with pool.acquire() as conn:
            recent = await conn.fetch(
                """
                SELECT tl.subject, tl.topic, tl.logged_at,
                       s.id AS student_id, s.name AS student_name, s.grade AS student_grade,
                       se.id AS session_id, se.title AS session_title
                FROM teaching_logs tl
                LEFT JOIN students s ON s.id = tl.student_id
                LEFT JOIN attendance_sessions se ON se.id = tl.session_id
                WHERE tl.volunteer_id = $1::uuid
                ORDER BY tl.logged_at DESC
                LIMIT $2
                """,
                volunteer_id,
                n,
            )
            totals_row = await conn.fetchrow(
                """
                SELECT COUNT(*)::int AS lessons,
                       COUNT(DISTINCT student_id)::int AS students,
                       COUNT(DISTINCT session_id)::int AS sessions,
                       ARRAY_AGG(DISTINCT subject) AS subjects
                FROM teaching_logs WHERE volunteer_id = $1::uuid
                """,
                volunteer_id,
            )
            per_student = await conn.fetch(
                """
                SELECT student_id, COUNT(*)::int AS lessons, MAX(logged_at) AS last_taught_by_me,
                       ARRAY_AGG(subject || ': ' || topic ORDER BY logged_at DESC) AS topics
                FROM teaching_logs WHERE volunteer_id = $1::uuid
                GROUP BY student_id
                ORDER BY MAX(logged_at) DESC
                LIMIT 30
                """,
                volunteer_id,
            )

            student_ids = [r["student_id"] for r in per_student]
            if student_ids:
                student_rows = await conn.fetch(
                    "SELECT id, name, grade FROM students WHERE id = ANY($1::uuid[])", student_ids
                )
                score_rows = await conn.fetch(
                    "SELECT student_id, subject, score, max_score FROM quiz_scores WHERE student_id = ANY($1::uuid[])",
                    student_ids,
                )
            else:
                student_rows, score_rows = [], []

        student_by_id = {s["id"]: s for s in student_rows}
        scores_by_student: dict = {}
        for row in score_rows:
            scores_by_student.setdefault(row["student_id"], []).append(row)

        subjects = [s for s in (totals_row["subjects"] or []) if s] if totals_row else []
        totals = (
            {
                "lessons": totals_row["lessons"],
                "distinctStudents": totals_row["students"],
                "sessionsTaught": totals_row["sessions"],
                "subjects": subjects,
            }
            if totals_row and totals_row["lessons"] > 0
            else {"lessons": 0, "distinctStudents": 0, "sessionsTaught": 0, "subjects": []}
        )

        return {
            "volunteer": volunteer_name,
            "totals": totals,
            "recentLessons": [
                {
                    "date": l["logged_at"],
                    "session": l["session_title"],
                    "student": l["student_name"],
                    "grade": l["student_grade"],
                    "subject": l["subject"],
                    "topic": l["topic"],
                }
                for l in recent
            ],
            "myStudents": [
                {
                    "name": (student_by_id.get(r["student_id"]) or {}).get("name"),
                    "grade": (student_by_id.get(r["student_id"]) or {}).get("grade"),
                    "lessonsWithMe": r["lessons"],
                    "lastTaughtByMe": r["last_taught_by_me"],
                    "daysSince": days_since(r["last_taught_by_me"]),
                    "recentTopicsWithMe": (r["topics"] or [])[:4],
                    "quizAveragePercent": quiz_average(
                        [{"score": q["score"], "maxScore": q["max_score"]} for q in scores_by_student.get(r["student_id"], [])]
                    ),
                }
                for r in per_student
            ],
        }

    return get_my_teaching_history
