"""
Shared helpers ported from server/services/agentTools.js — exact same
rounding/filtering rules, so a percentage or a "not taught for N days"
message reads identically regardless of which language answered it.
"""

import re
from datetime import datetime, timedelta, timezone
from typing import Optional


def normalise_subject(s: Optional[str]) -> str:
    # Teaching logs say "Maths", the resource library says "Math".
    s = str(s or "").strip()
    return "Math" if re.fullmatch(r"maths", s, re.IGNORECASE) else s


def days_ago(n: int) -> datetime:
    # Deployment runs in UTC (no TZ override anywhere in the Node service
    # either), so UTC midnight is the equivalent of the Node version's local
    # midnight in production.
    d = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return d - timedelta(days=n)


def quiz_average(scores: list[dict]) -> Optional[int]:
    """scores: [{"score": ..., "maxScore": ...}]. None when there is nothing gradeable."""
    valid = [q for q in scores if float(q.get("maxScore") or 0) > 0]
    if not valid:
        return None
    return round(sum(float(q["score"]) / float(q["maxScore"]) for q in valid) / len(valid) * 100)


def days_since(dt: Optional[datetime]) -> Optional[int]:
    if dt is None:
        return None
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int((now - dt).total_seconds() // 86400)
