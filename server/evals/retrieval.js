// Retrieval eval: run the golden queries through retrieveContext and score them.
//
//   npm run eval:retrieval                       # compare vector vs hybrid at the configured threshold
//   npm run eval:retrieval -- --mode hybrid      # one mode
//   npm run eval:retrieval -- --threshold 0.58   # try a different gate
//   npm run eval:retrieval -- --k 3 --verbose    # show every query, not just misses
//   npm run eval:retrieval -- --no-save          # do not record the run
//
// Reads evals/golden/retrieval.json. Writes an eval_runs row per mode unless --no-save.
require('dotenv').config();

const path = require('path');
const { desc, eq } = require('drizzle-orm');
const { connectPG } = require('../db/pool');
const { getDb } = require('../db');
const { evalRuns } = require('../db/schema');
const { retrieveContext } = require('../services/ragService');
const { callAiService, SYSTEM_USER } = require('../services/aiServiceClient');
const { EMBEDDING_PROVIDER, EMBEDDING_MODEL, SIMILARITY_THRESHOLD } = require('../services/llmClient');

// Embedding now happens in the Python ai-service (app/rag/embeddings.py);
// this just calls it, the same way retrieveContext does.
const embedText = async (text) => {
  const { embedding } = await callAiService('/rag/embed', { method: 'POST', user: SYSTEM_USER, body: { text } });
  return embedding;
};
const { scoreQuery, aggregate, aggregateByKind } = require('./lib/metrics');

const golden = require(path.join(__dirname, 'golden', 'retrieval.json'));

// ---- args ----
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const modesArg = flag('mode', 'both');
const MODES = modesArg === 'both' ? ['vector', 'hybrid'] : [modesArg];
const K = Number(flag('k', 5));
const THRESHOLD = flag('threshold') ? Number(flag('threshold')) : SIMILARITY_THRESHOLD;
const SAVE = !argv.includes('--no-save');
const VERBOSE = argv.includes('--verbose');

const pct = (x) => `${(x * 100).toFixed(0)}%`.padStart(4);
const f3 = (x) => x.toFixed(3);

async function runMode(mode, embeddings) {
  const rows = [];
  for (const q of golden.queries) {
    const returned = await retrieveContext({
      topic: q.topic,
      subject: q.subject,
      grade: q.grade,
      k: K,
      minSimilarity: THRESHOLD,
      mode,
      queryEmbedding: embeddings.get(q.id)
    });
    const score = scoreQuery(returned, q.expect, K);
    rows.push({
      id: q.id,
      kind: q.kind,
      topic: q.topic,
      expect: q.expect,
      ...score,
      top: returned.slice(0, K).map((c) => ({
        title: c.source.title.replace(/^Class \d+ \w+ - |^General Teaching Tips - /, '').slice(0, 42),
        similarity: Number(c.similarity.toFixed(3)),
        lexical: Number((c.lexical || 0).toFixed(2))
      }))
    });
  }
  return rows;
}

function printMode(mode, rows) {
  const all = aggregate(rows);
  const byKind = aggregateByKind(rows);

  console.log(`\n== ${mode.toUpperCase()}  (k=${K}, threshold=${THRESHOLD})`);
  console.log(
    `   precision@${K} ${pct(all.precisionAtK)}   recall@${K} ${pct(all.recallAtK)}   MRR ${f3(all.mrr)}   hit@1 ${pct(all.hitAt1)}` +
      `   misses ${all.misses}/${all.positives}   false positives ${all.falsePositives}/${all.negatives}`
  );
  console.log('   by kind:');
  for (const [kind, m] of Object.entries(byKind)) {
    const line =
      kind === 'negative'
        ? `false positives ${m.falsePositives}/${m.negatives}`
        : `recall ${pct(m.recallAtK)}  MRR ${f3(m.mrr)}  hit@1 ${pct(m.hitAt1)}  misses ${m.misses}/${m.positives}`;
    console.log(`     ${kind.padEnd(12)} ${line}`);
  }

  const problems = rows.filter((r) => (r.negative ? r.falsePositive : r.miss || !r.hitAt1));
  const show = VERBOSE ? rows : problems;
  if (show.length) {
    console.log(VERBOSE ? '   all queries:' : '   misses, false positives and wrong-first-hits:');
    for (const r of show) {
      const tag = r.negative ? (r.falsePositive ? 'FALSE+' : 'ok    ') : r.miss ? 'MISS  ' : r.hitAt1 ? 'ok    ' : 'rank>1';
      const top = r.top.map((t) => `${t.title} [${t.similarity}${t.lexical ? ` / bm25 ${t.lexical}` : ''}]`).join(' ; ') || '(nothing)';
      console.log(`     ${tag} ${r.id.padEnd(16)} "${r.topic}" → ${top}`);
    }
  }
  return { all, byKind };
}

async function main() {
  await connectPG();
  const db = getDb();
  const started = Date.now();
  console.log(
    `Golden set: ${golden.queries.length} queries. Embeddings: ${EMBEDDING_PROVIDER}/${EMBEDDING_MODEL}. Modes: ${MODES.join(', ')}.`
  );

  // Embed each query once and share across modes — the eval is about ranking,
  // not about paying for the same vector twice.
  const embeddings = new Map();
  for (const q of golden.queries) {
    embeddings.set(q.id, await embedText(`${q.topic} ${q.subject} ${q.grade}`));
  }

  const previous = SAVE
    ? Object.fromEntries(
        await Promise.all(
          MODES.map(async (mode) => {
            const rows = await db
              .select()
              .from(evalRuns)
              .where(eq(evalRuns.kind, 'retrieval'))
              .orderBy(desc(evalRuns.createdAt));
            const match = rows.find((r) => r.config?.mode === mode);
            return [mode, match || null];
          })
        )
      )
    : {};

  const results = {};
  for (const mode of MODES) {
    const rows = await runMode(mode, embeddings);
    results[mode] = { rows, ...printMode(mode, rows) };

    const prev = previous[mode];
    if (prev) {
      const d = (key) => {
        const delta = results[mode].all[key] - prev.metrics[key];
        return `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}pt`;
      };
      console.log(
        `   vs last ${mode} run (${new Date(prev.createdAt).toLocaleString('en-IN')}, k=${prev.config.k}, threshold=${prev.config.threshold}): ` +
          `recall ${d('recallAtK')}, precision ${d('precisionAtK')}, hit@1 ${d('hitAt1')}, false-positive rate ${d('falsePositiveRate')}`
      );
    }

    if (SAVE) {
      await db.insert(evalRuns).values({
        kind: 'retrieval',
        config: { mode, k: K, threshold: THRESHOLD, embeddingProvider: EMBEDDING_PROVIDER, embeddingModel: EMBEDDING_MODEL, goldenSize: golden.queries.length },
        metrics: { ...results[mode].all, byKind: results[mode].byKind },
        perQuery: rows,
        durationMs: Date.now() - started
      });
    }
  }

  if (MODES.length === 2) {
    const [a, b] = MODES;
    const A = results[a].all, B = results[b].all;
    const cmp = (key, higherIsBetter = true) => {
      const diff = B[key] - A[key];
      const better = diff === 0 ? 'same' : (diff > 0) === higherIsBetter ? b : a;
      return `${key}: ${a} ${pct(A[key])} vs ${b} ${pct(B[key])} → ${better}`;
    };
    console.log(`\n== ${a} vs ${b}`);
    console.log('   ' + cmp('recallAtK'));
    console.log('   ' + cmp('precisionAtK'));
    console.log('   ' + cmp('hitAt1'));
    console.log('   ' + cmp('falsePositiveRate', false));
  }

  console.log(`\n${SAVE ? 'Saved.' : 'Not saved (--no-save).'} ${Date.now() - started}ms.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
