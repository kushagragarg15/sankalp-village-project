"""
Exact port of server/services/lexicalSearch.js — BM25 keyword scoring plus
Reciprocal Rank Fusion, run in-process over the SQL-prefiltered candidate set
(a few dozen chunks), same as the Node version. Deliberately not
PostgreSQL's tsvector/ts_rank: Postgres's `english` stemmer and stopword list
differ from this domain stop-list and suffix rule, and the eval is what
proved this exact ranking (the domain stop-list exists because "children" in
a fractions query beat "roti" in the fractions guide before it was added) —
swapping it changes ranking semantics without a re-eval to catch it.
"""

import math
import re

# English function words, plus words that appear in almost every teaching
# resource and so carry no signal here ("children", "activity", "learn").
STOPWORDS = frozenset(
    (
        "a an and are as at be by for from has have how in is it its of on or that the this to was "
        "what when where which who why will with one two between each other "
        "class grade students student child children kids kid teacher teach teaching lesson learn learning "
        "activity activities practice help helping simple everyday about into use using"
    ).split(" ")
)

_SPLIT_RE = re.compile(r"[^a-z0-9]+")
_SUFFIX_RE = re.compile(r"(ing|ies|es|s)$")


def _strip_suffix(token: str) -> str:
    m = _SUFFIX_RE.search(token)
    if not m:
        return token
    return token[: m.start()] + ("y" if m.group(1) == "ies" else "")


def tokenize(text: str) -> list[str]:
    lowered = str(text).lower()
    parts = [p for p in _SPLIT_RE.split(lowered) if p]
    return [_strip_suffix(t) for t in parts if len(t) > 1 and t not in STOPWORDS]


def bm25_scores(query: str, documents: list[str], k1: float = 1.5, b: float = 0.75) -> list[float]:
    # dict.fromkeys preserves insertion order while de-duplicating, matching
    # `[...new Set(tokenize(query))]`.
    query_terms = list(dict.fromkeys(tokenize(query)))
    if not query_terms:
        return [0.0] * len(documents)

    doc_tokens = [tokenize(doc) for doc in documents]
    n = len(documents)
    avgdl = sum(len(d) for d in doc_tokens) / max(n, 1)

    df = {term: sum(1 for d in doc_tokens if term in d) for term in query_terms}

    scores: list[float] = []
    for tokens in doc_tokens:
        if not tokens:
            scores.append(0.0)
            continue
        tf: dict[str, int] = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1

        score = 0.0
        for term in query_terms:
            f = tf.get(term, 0)
            if f == 0:
                continue
            n_docs_with_term = df[term]
            idf = math.log(1 + (n - n_docs_with_term + 0.5) / (n_docs_with_term + 0.5))
            norm = f + k1 * (1 - b + (b * len(tokens)) / avgdl)
            score += idf * ((f * (k1 + 1)) / norm)
        scores.append(score)

    return scores


def reciprocal_rank_fusion(
    rankings: list[list[int]], item_count: int, k: int = 60, weights: list[float] | None = None
) -> list[float]:
    fused = [0.0] * item_count
    for list_index, ranking in enumerate(rankings):
        w = weights[list_index] if weights else 1.0
        for rank, item_index in enumerate(ranking):
            fused[item_index] += w / (k + rank + 1)
    return fused
