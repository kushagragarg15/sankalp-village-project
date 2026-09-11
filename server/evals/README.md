# Evals

Two harnesses, one golden set. Both save every run to the `EvalRun` collection and
print the delta against the previous run of the same kind, so a change to the
retriever, the prompts, the embedding model or the chunking is judged against
numbers instead of against memory.

```bash
cd server
npm run eval:retrieval                  # vector vs hybrid, side by side, at the configured threshold
npm run eval:retrieval -- --mode hybrid --threshold 0.58 --k 3 --verbose --no-save
npm run eval:generation                 # 6 lesson plans, structure checks + LLM judge
npm run eval:generation -- --ids frac-direct,water-para --judge-model openai/gpt-oss-20b
```

## The golden set — `golden/retrieval.json`

29 queries over the 8-resource library. Each names the resource(s) whose chunks
count as relevant (`expect`, by title substring) — or none, for a negative.
The `kind` field says what each query is for:

| kind | tests | example |
|---|---|---|
| `direct` | the obvious case; both search styles should get it | "fractions" |
| `paraphrase` | no shared words with the resource; only semantic search can get it | "sharing one roti equally between children" |
| `lexical` | an exact, rare term; keyword search should get it, embeddings may drift | "chlorophyll" |
| `cross-grade` | the resource is for an adjacent class; tests the ±1 grade filter | fractions for Class 5 (resource is Class 4) |
| `negative` | nothing in the library covers it; anything returned is a false positive | "rules of cricket" |

Relevance is decided at the **resource** level, not the chunk level — the
volunteer needs *the fractions guide*, not paragraph 2 of it.

When you add a resource, add at least one query of each positive kind for it,
and keep the negatives honest (a negative that a new resource now legitimately
answers must be moved, not deleted).

## Retrieval metrics

Averaged over the positive queries, at the cut-off `k` (default 5):

- **recall@k** — of the expected resources, how many appeared at all. The one
  that matters most: a miss here means the planner writes from nothing.
- **precision@k** — of the chunks returned, how many were relevant. Low
  precision fills the prompt with noise.
- **MRR** — 1 / rank of the first relevant chunk. 1.0 means the best chunk was
  always first.
- **hit@1** — was the first chunk relevant.
- **misses** — positive queries that returned nothing relevant.

Over the negative queries:

- **false-positive rate** — how often something came back when nothing should.

Recall and the false-positive rate pull in opposite directions and the
similarity threshold is the dial between them. On this library with
`gemini-embedding-001` (2026-09):

| threshold | recall@5 | false positives | note |
|---|---|---|---|
| 0.75 | 21% | 0/5 | the value tuned for OpenAI embeddings — returned nothing for most queries |
| 0.62 | 100% | 0/5 | current `SIMILARITY_THRESHOLD` for Gemini |
| 0.55 | 100% | 4/5 | everything looks relevant |

**The threshold is a property of the embedding model.** It lives in
`llmClient.js` next to the model name for that reason. Re-run this eval
whenever either changes.

### vector vs hybrid

`RETRIEVAL_MODE=hybrid` adds BM25 keyword scoring over the pre-filtered chunks
and fuses the two rankings with Reciprocal Rank Fusion (semantic list weighted
1, keyword list 0.5), then gates on the semantic threshold with a narrow
keyword rescue. On the current library the two **tie on every metric**
(recall 100%, MRR 1.0, 0 false positives), so `vector` is the default: it is
the simpler one and there is no measured reason to pay for the other.

That is a finding, not a failure. Hybrid earns its keep when a library has
terms embeddings handle badly — transliterated Hindi, acronyms, proper nouns —
and this one does not yet. The first hybrid run *lost* to vector (hit@1 96%)
because BM25 matched "children" in a fractions query harder than "roti"; the
fix was a domain stop-list and the 0.5 weight. The eval caught it; nobody
would have by eye.

## Generation metrics

For a slice of the golden queries, generate a lesson plan with the real
pipeline and grade it two ways:

1. **Deterministic checks** — has all five required sections, sensible length,
   and no *un-negated* mention of printed materials ("no worksheets needed" is
   fine; "give each child a worksheet" is not). Cheap, exact, run first.
2. **LLM judge** — scores 1–5 against a rubric on **faithfulness** to the
   retrieved passages, **gradeFit**, **lowResource** feasibility and
   **completeness**, lists concrete issues, and gives a pass/fail verdict. The
   judge reply is JSON, validated with zod, one retry on a bad reply.

A query passes only if the judge passes it *and* the deterministic checks pass.
The two catch different things: the judge found "one printed copy of the short
story" that the regex had missed; the regex is what makes the negation rule
explicit and repeatable.

### Caveats you should be able to say out loud

- **Self-judging.** By default the judge is the same model as the generator, and
  it scores generously (5/5 across the board until there was a real problem).
  Pass `--judge-model` with a different model when you have one; treat the
  absolute numbers as soft and the *deltas* between runs as the signal.
- **Non-determinism.** Generation runs at temperature 0.7, so a single query
  can flip between runs. Look at the pass rate over the set, not one row.
- **Small set.** 6–8 generation queries is enough to catch a broken prompt, not
  to rank two good prompts. Grow it before trusting fine differences.
- **The judge's rubric is the product spec.** "No printed materials" was in the
  rubric before it was in the planner prompt; the first run failed a plan for
  exactly that, and the prompt was fixed. That is the loop working as intended.

## History

Runs are in Mongo:

```js
db.evalruns.find({ kind: 'retrieval' }, { createdAt: 1, 'config.mode': 1, 'config.threshold': 1, 'metrics.recallAtK': 1, 'metrics.falsePositiveRate': 1 }).sort({ createdAt: -1 })
```

`perQuery` on each run holds the per-query rows (and, for generation, a plan
excerpt and the judge's issues), so a regression can be traced to the query
that moved.
