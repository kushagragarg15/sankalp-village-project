/**
 * Retrieval metrics, computed per query and averaged.
 *
 * "Relevant" is decided at the resource level: a returned chunk counts as a
 * hit if its resource title contains one of the query's `expect` substrings.
 * That is the right granularity here — the volunteer needs *the fractions
 * guide*, not a specific paragraph of it.
 */

const isRelevant = (chunk, expect) => expect.some((e) => chunk.source.title.includes(e));

/**
 * @param {Array<{source:{title:string}}>} returned - chunks in rank order
 * @param {string[]} expect - relevant title substrings ([] for a negative query)
 * @param {number} k
 */
function scoreQuery(returned, expect, k) {
  const top = returned.slice(0, k);
  const flags = top.map((c) => isRelevant(c, expect));

  if (expect.length === 0) {
    // Negative query: the only thing that matters is whether anything came back.
    return {
      negative: true,
      returned: top.length,
      falsePositive: top.length > 0
    };
  }

  const hits = flags.filter(Boolean).length;
  const firstHit = flags.indexOf(true);
  // Recall is over distinct expected resources: did each one appear at least once?
  const foundResources = new Set();
  for (const c of top) for (const e of expect) if (c.source.title.includes(e)) foundResources.add(e);

  return {
    negative: false,
    returned: top.length,
    precisionAtK: top.length ? hits / top.length : 0,
    recallAtK: foundResources.size / expect.length,
    hitAt1: firstHit === 0,
    reciprocalRank: firstHit === -1 ? 0 : 1 / (firstHit + 1),
    miss: hits === 0
  };
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Aggregate per-query scores into the headline numbers. */
function aggregate(rows) {
  const positives = rows.filter((r) => !r.negative);
  const negatives = rows.filter((r) => r.negative);
  return {
    queries: rows.length,
    positives: positives.length,
    negatives: negatives.length,
    precisionAtK: mean(positives.map((r) => r.precisionAtK)),
    recallAtK: mean(positives.map((r) => r.recallAtK)),
    mrr: mean(positives.map((r) => r.reciprocalRank)),
    hitAt1: mean(positives.map((r) => (r.hitAt1 ? 1 : 0))),
    misses: positives.filter((r) => r.miss).length,
    falsePositiveRate: mean(negatives.map((r) => (r.falsePositive ? 1 : 0))),
    falsePositives: negatives.filter((r) => r.falsePositive).length
  };
}

/** Same aggregates, but per query kind — where a mode wins or loses. */
function aggregateByKind(rows) {
  const kinds = [...new Set(rows.map((r) => r.kind))];
  return Object.fromEntries(kinds.map((kind) => [kind, aggregate(rows.filter((r) => r.kind === kind))]));
}

module.exports = { scoreQuery, aggregate, aggregateByKind, isRelevant };
