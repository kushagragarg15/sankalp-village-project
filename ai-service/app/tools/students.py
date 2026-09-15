"""
Port of the student-facing tools in server/services/agentTools.js:
get_student_progress, find_students_needing_attention.

Neither tool ever selects students.parent_phone — same rule as the Node
version ("Tools return only what the model needs... so it can never leak
into a prompt or a transcript").
"""

from datetime import datetime, timezone
from typing import Optional

from langchain_core.tools import tool

from ..db import get_pool
from .common import days_ago, days_since

_EPOCH = datetime.min.replace(tzinfo=timezone.utc)


@tool
async def get_student_progress(name: str) -> dict:
    """Look up one student by name (partial names work). Returns their class, how many sessions
    they attended, which subjects and topics they were taught (most recent first) and their
    quiz scores. This is THE tool for any question about a named child ("how is Aarti doing?"),
    whoever taught them. Only skip it if you already have that child's data from a tool result
    earlier in this conversation."""
    pool = get_pool()
    async with pool.acquire() as conn:
        candidates = await conn.fetch(
            "SELECT id, name, grade, enrollment_date FROM students WHERE name ILIKE $1 LIMIT 5",
            f"%{name}%",
        )

        if not candidates:
            return {"found": False, "message": f'No student matching "{name}".'}
        if len(candidates) > 1:
            return {
                "found": False,
                "ambiguous": True,
                "message": "Several students match; ask the user which one they mean.",
                "options": [{"name": c["name"], "grade": c["grade"]} for c in candidates],
            }

        student = candidates[0]
        logs = await conn.fetch(
            """
            SELECT tl.subject, tl.topic, tl.logged_at, tl.session_id, u.name AS volunteer_name
            FROM teaching_logs tl
            LEFT JOIN users u ON u.id = tl.volunteer_id
            WHERE tl.student_id = $1::uuid
            ORDER BY tl.logged_at DESC
            LIMIT 40
            """,
            student["id"],
        )
        scores = await conn.fetch(
            """
            SELECT subject, topic, score, max_score, taken_at
            FROM quiz_scores WHERE student_id = $1::uuid
            ORDER BY taken_at DESC LIMIT 10
            """,
            student["id"],
        )

    sessions_attended = len({row["session_id"] for row in logs})
    last_taught = logs[0]["logged_at"] if logs else None

    return {
        "found": True,
        "student": {"name": student["name"], "grade": student["grade"], "enrolledOn": student["enrollment_date"]},
        "sessionsAttended": sessions_attended,
        "lastTaught": last_taught,
        "daysSinceLastTaught": days_since(last_taught),
        "recentLessons": [
            {
                "date": l["logged_at"],
                "subject": l["subject"],
                "topic": l["topic"],
                "volunteer": l["volunteer_name"],
            }
            for l in logs[:12]
        ],
        "quizScores": [
            {
                "subject": q["subject"],
                "topic": q["topic"],
                "percent": round(float(q["score"]) / float(q["max_score"]) * 100) if float(q["max_score"]) else None,
                "date": q["taken_at"],
            }
            for q in scores
        ],
    }


@tool
async def find_students_needing_attention(
    grade: Optional[str] = None,
    subject: Optional[str] = None,
    not_taught_for_days: int = 21,
    low_score_below_percent: int = 50,
) -> dict:
    """Find students who may be falling behind: not taught for a while, or with low quiz
    averages. Optionally narrow by class or subject. Use this for questions like "who have
    we missed", "who is struggling in Math", or when planning whom to focus on.

    grade: restrict to one class, e.g. "Class 4".
    subject: restrict quiz analysis to one subject.
    not_taught_for_days: flag students with no lesson in this many days (default 21).
    low_score_below_percent: flag students whose average quiz score is below this (default 50)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        students = await (
            conn.fetch("SELECT id, name, grade FROM students WHERE grade ILIKE $1", f"%{grade}%")
            if grade
            else conn.fetch("SELECT id, name, grade FROM students")
        )
        if not students:
            return {"students": [], "message": "No students match."}

        ids = [s["id"] for s in students]

        # One round trip for everyone's last lesson.
        last_lessons = await conn.fetch(
            "SELECT student_id, MAX(logged_at) AS last_taught FROM teaching_logs WHERE student_id = ANY($1::uuid[]) GROUP BY student_id",
            ids,
        )
        last_taught_by_id = {row["student_id"]: row["last_taught"] for row in last_lessons}

        # All quiz scores for the candidate set, filtered by subject in Python
        # (matches the original average-since-the-selected-subject logic).
        all_scores = await conn.fetch(
            "SELECT student_id, subject, score, max_score FROM quiz_scores WHERE student_id = ANY($1::uuid[])",
            ids,
        )

    scores_by_student: dict = {}
    for row in all_scores:
        scores_by_student.setdefault(row["student_id"], []).append(row)

    cutoff = days_ago(not_taught_for_days)
    subject_lower = subject.lower() if subject else None

    flagged = []
    for s in students:
        reasons = []
        last_taught = last_taught_by_id.get(s["id"])

        if last_taught is None:
            reasons.append("never taught")
        elif last_taught < cutoff:
            reasons.append(f"not taught for {days_since(last_taught)} days")

        scores = [
            q
            for q in scores_by_student.get(s["id"], [])
            if float(q["max_score"] or 0) and (not subject_lower or subject_lower in q["subject"].lower())
        ]
        if scores:
            avg = round(sum(float(q["score"]) / float(q["max_score"]) for q in scores) / len(scores) * 100)
            if avg < low_score_below_percent:
                reasons.append(f"quiz average {avg}%" + (f" in {subject}" if subject else ""))

        if reasons:
            flagged.append({"name": s["name"], "grade": s["grade"], "lastTaught": last_taught, "reasons": reasons})

    # `None` sorts as the earliest possible date, same as JS's `lastTaught || 0`.
    flagged.sort(key=lambda f: f["lastTaught"] or _EPOCH)

    return {
        "checked": len(students),
        "flagged": len(flagged),
        "criteria": {
            "notTaughtForDays": not_taught_for_days,
            "lowScoreBelowPercent": low_score_below_percent,
            "grade": grade or "any",
            "subject": subject or "any",
        },
        "students": flagged[:25],
    }
