/**
 * BM25 keyword scoring over a small candidate set.
 *
 * Semantic search misses exact terms — a query for "vilom shabd" or "BODMAS"
 * scores poorly against an embedding that never saw the word, and a query that
 * shares a word with a chunk can rank above the chunk that actually answers
 * it. Classic keyword ranking has the opposite failure. Hybrid search runs
 * both and fuses them (see ragService.retrieveContext).
 *
 * This is deliberately in-process: the metadata pre-filter leaves a few dozen
 * chunks, so a real inverted index would be overhead. The maths is the
 * textbook Okapi BM25 so it can be explained on a whiteboard.
 */

// English function words, plus words that appear in almost every teaching
// resource and so carry no signal here ("children", "activity", "learn"). The
// eval caught the need for the second group: "children" in a fractions query
// matched the addition guide harder than "roti" matched the fractions guide.
const STOPWORDS = new Set(
  ('a an and are as at be by for from has have how in is it its of on or that the this to was ' +
   'what when where which who why will with one two between each other ' +
   'class grade students student child children kids kid teacher teach teaching lesson learn learning ' +
   'activity activities practice help helping simple everyday about into use using').split(' ')
);

// Lowercase, split on non-alphanumerics, drop stopwords and 1-char tokens,
// strip the most common English suffixes so "fractions" meets "fraction".
function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => t.replace(/(ing|ies|es|s)$/, (m) => (m === 'ies' ? 'y' : '')));
}

/**
 * Score each document against the query. Returns one number per document
 * (0 = no query term present).
 *
 * @param {string} query
 * @param {string[]} documents
 * @param {{k1?: number, b?: number}} [params]
 * @returns {number[]}
 */
function bm25Scores(query, documents, { k1 = 1.5, b = 0.75 } = {}) {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0) return documents.map(() => 0);

  const docTokens = documents.map(tokenize);
  const N = documents.length;
  const avgdl = docTokens.reduce((n, d) => n + d.length, 0) / Math.max(N, 1);

  // Document frequency per query term.
  const df = new Map();
  for (const term of queryTerms) {
    df.set(term, docTokens.filter((d) => d.includes(term)).length);
  }

  return docTokens.map((tokens) => {
    if (tokens.length === 0) return 0;
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

    let score = 0;
    for (const term of queryTerms) {
      const f = tf.get(term) || 0;
      if (f === 0) continue;
      const n = df.get(term);
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const norm = f + k1 * (1 - b + (b * tokens.length) / avgdl);
      score += idf * ((f * (k1 + 1)) / norm);
    }
    return score;
  });
}

/**
 * Reciprocal Rank Fusion: combine several rankings of the same items into one.
 * Each ranking contributes 1 / (K + rank); items high in any list rise. K=60 is
 * the constant from the original paper and works well when lists are short.
 *
 * @param {number[][]} rankings - each is an array of item indices in rank order
 * @param {number} itemCount
 * @param {number} [K]
 * @param {number[]} [weights] - per-ranking weight; lets the semantic list count for more
 * @returns {number[]} fused score per item index
 */
function reciprocalRankFusion(rankings, itemCount, K = 60, weights = null) {
  const fused = new Array(itemCount).fill(0);
  rankings.forEach((ranking, listIndex) => {
    const w = weights ? weights[listIndex] : 1;
    ranking.forEach((itemIndex, rank) => {
      fused[itemIndex] += w / (K + rank + 1);
    });
  });
  return fused;
}

module.exports = { tokenize, bm25Scores, reciprocalRankFusion };
