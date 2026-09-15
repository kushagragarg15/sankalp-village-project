"""
Chat completion — port of the retry half of server/services/llmClient.js
(`chatWithRetry`) plus a LangChain `ChatOpenAI` client, used only by
draft_lesson_plan's generation step for now. Free-tier providers rate-limit
per minute (see project notes on Groq/Gemini quotas), so retrying 429/5xx
with the provider's own suggested wait is not optional polish — without it
a burst of tool calls just fails.
"""

import asyncio
import re
from functools import lru_cache

import openai
from langchain_openai import ChatOpenAI

from ..config import get_settings
from ..errors import classify_provider_error
from ..llm import PROVIDERS, resolve_llm_config


class ChatNotConfigured(RuntimeError):
    pass


@lru_cache
def get_chat_client() -> ChatOpenAI:
    settings = get_settings()
    config = resolve_llm_config(settings)
    if not config:
        raise ChatNotConfigured("No chat provider configured. Set GROQ_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY.")

    provider_info = PROVIDERS[config.chat_provider]
    api_key = getattr(settings, provider_info.api_key_env.lower())
    if not api_key:
        raise ChatNotConfigured(f"{provider_info.api_key_env} not configured")

    # max_retries=0: this module owns retries (chat_with_retry), same
    # reasoning as llmClient.js — every 429 is backed off deliberately, once,
    # not silently retried twice by two different layers.
    return ChatOpenAI(model=config.chat_model, api_key=api_key, base_url=provider_info.base_url, max_retries=0, timeout=60)


RETRY_DELAYS_S = [2, 5, 12, 25]
MAX_RETRY_WAIT_S = 30
_GROQ_WAIT_RE = re.compile(r"try again in ((?:\d+h)?(?:\d+m)?(?:[\d.]+s)?)", re.IGNORECASE)


def _suggested_delay_s(err: openai.APIStatusError) -> float | None:
    header = err.response.headers.get("retry-after") if err.response is not None else None
    if header:
        try:
            return float(header)
        except ValueError:
            pass
    # "11.2s", "4m1.05s", "1h2m3s" — Groq writes the wait in mixed units.
    m = _GROQ_WAIT_RE.search(str(err))
    if not m or not m.group(1):
        return None
    unit_match = lambda pat: re.search(pat, m.group(1))
    h = int(unit_match(r"(\d+)h").group(1)) if unit_match(r"(\d+)h") else 0
    mins = int(unit_match(r"(\d+)m").group(1)) if unit_match(r"(\d+)m") else 0
    sec = float(unit_match(r"([\d.]+)s").group(1)) if unit_match(r"([\d.]+)s") else 0
    total = h * 3600 + mins * 60 + sec
    return total + 0.5 if total > 0 else None


def _ms(seconds: float | None) -> int | None:
    return int(seconds * 1000) if seconds else None


def _is_retryable(err: openai.APIStatusError) -> tuple[bool, float | None]:
    status = getattr(err, "status_code", None) or (err.response.status_code if err.response else None)
    retryable = status == 429 or (status is not None and 500 <= status < 600)
    return retryable, _suggested_delay_s(err)


async def invoke_with_retry(runnable, messages: list):
    """
    Generic `.ainvoke` with retry on 429/5xx — the one retry implementation
    shared by plain chat (draft_lesson_plan) and the tool-bound agent model,
    so backoff behaviour is not duplicated per call site. Anything else (a
    bad key, a bad request) will not get better by waiting and is raised at
    once.
    """
    attempt = 0
    while True:
        try:
            return await runnable.ainvoke(messages)
        except (openai.RateLimitError, openai.APIStatusError) as err:
            retryable, suggested = _is_retryable(err)
            if not retryable or attempt >= len(RETRY_DELAYS_S):
                raise classify_provider_error(err, suggested_delay_ms=_ms(suggested)) from err
            if suggested and suggested > MAX_RETRY_WAIT_S:
                raise classify_provider_error(err, suggested_delay_ms=_ms(suggested)) from err
            await asyncio.sleep(suggested or RETRY_DELAYS_S[attempt])
            attempt += 1


async def stream_with_retry(runnable, messages: list):
    """
    Retries apply only to *opening* the stream (where a 429 arrives); once
    chunks are flowing, a failure is the caller's to handle. Returns an async
    iterator of message chunks.
    """
    attempt = 0
    while True:
        try:
            # Opening the stream can itself raise before yielding anything
            # (auth/rate-limit errors surface on the first chunk pull), so
            # peek one chunk inside the retry loop rather than just
            # constructing the generator.
            stream = runnable.astream(messages)
            first_chunk = await stream.__anext__()

            async def _rest(first):
                yield first
                async for chunk in stream:
                    yield chunk

            return _rest(first_chunk)
        except StopAsyncIteration:
            async def _empty():
                return
                yield  # pragma: no cover

            return _empty()
        except (openai.RateLimitError, openai.APIStatusError) as err:
            retryable, suggested = _is_retryable(err)
            if not retryable or attempt >= len(RETRY_DELAYS_S):
                raise classify_provider_error(err, suggested_delay_ms=_ms(suggested)) from err
            if suggested and suggested > MAX_RETRY_WAIT_S:
                raise classify_provider_error(err, suggested_delay_ms=_ms(suggested)) from err
            await asyncio.sleep(suggested or RETRY_DELAYS_S[attempt])
            attempt += 1


async def chat_with_retry(messages: list, **kwargs):
    """chat.completions-equivalent with retry on 429/5xx."""
    client = get_chat_client()
    bound = client.bind(**kwargs) if kwargs else client
    return await invoke_with_retry(bound, messages)
