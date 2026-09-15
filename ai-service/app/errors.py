"""
The provider-failure envelope every AI route raises on a 429/5xx/auth
failure from the LLM provider, so Node has one consistent shape to translate
into its existing response/header contract instead of parsing message text.
"""

import math
import re
from typing import Literal, Optional

ProviderErrorCode = Literal["rate_limited", "no_credits", "provider_error"]


class ProviderError(Exception):
    def __init__(self, code: ProviderErrorCode, message: str, retry_after_ms: Optional[int] = None):
        self.code = code
        self.message = message
        self.retry_after_ms = retry_after_ms
        super().__init__(message)

    def to_dict(self) -> dict:
        return {"code": self.code, "retryAfterMs": self.retry_after_ms, "message": self.message}


def _when_phrase(retry_after_ms: Optional[int]) -> str:
    if not retry_after_ms:
        return "in a minute"
    secs = math.ceil(retry_after_ms / 1000)
    return f"in about {secs} seconds" if secs < 90 else f"in about {math.ceil(secs / 60)} minutes"


def classify_provider_error(err: Exception, *, suggested_delay_ms: Optional[int] = None) -> ProviderError:
    """
    Turns a raw provider exception (already known to be non-retryable, or a
    429/5xx whose retries are exhausted) into the envelope. Mirrors
    server/controllers/aiController.js's old `providerBusyMessage`.
    """
    msg = str(err)
    status = getattr(err, "status_code", None)

    if status is None:
        response = getattr(err, "response", None)
        status = getattr(response, "status_code", None) if response is not None else None

    if re.search(r"no credits|insufficient_quota|billing details", msg, re.IGNORECASE):
        return ProviderError(
            "no_credits", "The AI service has no credits left. Ask the coordinator to top up the provider account."
        )

    if status == 401:
        return ProviderError("provider_error", "Invalid API key for the LLM provider.")

    if status == 429:
        daily = (
            " The club's daily AI allowance with this provider is used up for now."
            if re.search(r"per day|TPD|RPD", msg, re.IGNORECASE)
            else ""
        )
        return ProviderError(
            "rate_limited",
            f"The AI provider is busy. Try again {_when_phrase(suggested_delay_ms)}.{daily}",
            retry_after_ms=suggested_delay_ms,
        )

    if status is not None and 500 <= status < 600:
        return ProviderError("provider_error", "The AI provider is temporarily unavailable. Try again shortly.")

    return ProviderError("provider_error", msg or "The AI provider returned an unexpected error.")
