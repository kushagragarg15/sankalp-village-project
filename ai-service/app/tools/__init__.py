"""
Tool registry — the Python port of server/services/agentTools.js. This is
now the one authoritative implementation of the club's 7 agent tools;
agentTools.js still runs in Node (the agent loop, sessionPrepService and the
MCP server all still call it) until each of those three consumers migrates,
but nothing further should be added to the JS version — new tool logic
belongs here.

Role scoping mirrors `toolsForRole`: `roles` metadata decides which tools a
caller is even told about. Whoever wires these into an LLM loop must also
re-check the role before executing a call the model names anyway — the same
two-gate discipline agentService.js uses. That re-check is not implemented
here because the agent loop itself has not moved yet.
"""

from typing import Literal

from langchain_core.tools import BaseTool

from .history import make_get_my_teaching_history
from .resources import draft_lesson_plan, search_teaching_resources
from .sessions import list_sessions
from .students import find_students_needing_attention, get_student_progress
from .volunteers import get_volunteer_stats

ROLES_ALL = ("admin", "volunteer")
ROLES_ADMIN = ("admin",)

search_teaching_resources.metadata = {"roles": ROLES_ALL}
draft_lesson_plan.metadata = {"roles": ROLES_ALL}
get_student_progress.metadata = {"roles": ROLES_ALL}
find_students_needing_attention.metadata = {"roles": ROLES_ALL}
list_sessions.metadata = {"roles": ROLES_ALL}
get_volunteer_stats.metadata = {"roles": ROLES_ADMIN}

# Tools that don't depend on who is asking — built once.
_STATIC_TOOLS: list[BaseTool] = [
    search_teaching_resources,
    draft_lesson_plan,
    get_student_progress,
    find_students_needing_attention,
    list_sessions,
    get_volunteer_stats,
]


def tools_for_user(role: Literal["admin", "volunteer"], user_id: str, user_name: str) -> list[BaseTool]:
    """
    All tools this role may see, with get_my_teaching_history freshly bound
    to this specific user — mirrors `toolsForRole(role)` plus the `ctx.user`
    every JS tool receives as its run() context.
    """
    my_history = make_get_my_teaching_history(user_id, user_name)
    my_history.metadata = {"roles": ROLES_ALL}

    all_tools = [*_STATIC_TOOLS, my_history]
    return [t for t in all_tools if role in t.metadata["roles"]]


__all__ = ["tools_for_user", "ROLES_ALL", "ROLES_ADMIN"]
