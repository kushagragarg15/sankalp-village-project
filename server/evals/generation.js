// Generation eval: generate lesson plans for a slice of the golden queries and
// grade each one — deterministically for structure, and with an LLM judge
// against a rubric for the things a regex cannot see (is it faithful to the
// retrieved passages? is it pitched at the right class? could it actually be
// taught with chalk and stones?).
//
//   npm run eval:generation                    # default 6 queries
//   npm run eval:generation -- --limit 3
//   npm run eval:generation -- --ids frac-direct,water-para
//   npm run eval:generation -- --judge-model openai/gpt-oss-20b
//   npm run eval:generation -- --no-save
//
// Each query costs two model calls (generate + judge). Free-tier providers
// throttle per minute, so this runs sequentially and leans on chatWithRetry.
require('dotenv').config();

const path = require('path');
const { z } = require('zod');
const connectDB = require('../config/db');
const EvalRun = require('../models/EvalRun');
const { generateLessonPlan } = require('../services/ragService');
const { chatWithRetry, CHAT_MODEL, CHAT_PROVIDER } = require('../services/llmClient');

const golden = require(path.join(__dirname, 'golden', 'retrieval.json'));

// ---- args ----
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const LIMIT = Number(flag('limit', 6));
const IDS = flag('ids') ? String(flag('ids')).split(',') : null;
const JUDGE_MODEL = flag('judge-model', CHAT_MODEL);
const SAVE = !argv.includes('--no-save');

// One query per resource by default, mixing query kinds, so a regression in
// any one resource's grounding shows up.
const DEFAULT_IDS = ['frac-direct', 'add-para', 'phon-lex', 'read-direct', 'water-para', 'photo-direct', 'geo-lex', 'mixed-para'];

// ---- deterministic checks: cheap, exact, run first ----
const SECTIONS = [
  ['objective', /learning objective|objective/i],
  ['concepts', /key concepts?/i],
  ['explanation', /explanation/i],
  ['activity', /activity/i],
  ['quiz', /quiz|questions?/i]
];

function structuralChecks(plan) {
  const missing = SECTIONS.filter(([, re]) => !re.test(plan)).map(([name]) => name);
  const words = plan.trim().split(/\s+/).length;
  // A plan that *avoids* printed material will often say so ("no worksheets",
  // "instead of a handout"), so a mention only counts when it is not negated
  // in the few words before it. Keep the matched context so a verdict can be
  // audited later.
  const term = /\b(worksheets?|printouts?|photocop\w*|handouts?|printed (sheets?|cards?|pages?|cop(y|ies)|texts?|stor(y|ies)))\b/gi;
  const negated = /\b(no|not|without|never|instead of|rather than|avoid\w*|don'?t need|zero)\b[^.]{0,25}$/i;
  let printed = null;
  for (let m = term.exec(plan); m; m = term.exec(plan)) {
    const before = plan.slice(Math.max(0, m.index - 40), m.index);
    if (negated.test(before)) continue;
    printed = plan.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
    break;
  }
  return {
    hasAllSections: missing.length === 0,
    missingSections: missing,
    words,
    lengthOk: words >= 200 && words <= 1200,
    mentionsPrintedMaterials: Boolean(printed),
    printedMatch: printed ? printed.replace(/\s+/g, ' ').trim() : null
  };
}

// ---- LLM judge ----
const JudgeSchema = z.object({
  faithfulness: z.number().int().min(1).max(5),
  gradeFit: z.number().int().min(1).max(5),
  lowResource: z.number().int().min(1).max(5),
  completeness: z.number().int().min(1).max(5),
  issues: z.array(z.string()).max(6),
  verdict: z.enum(['pass', 'fail'])
});

const judgeSystem = `You are a strict reviewer of lesson plans for volunteer teachers in a one-room village school in Rajasthan with almost no materials (chalk, a board, stones, sticks, everyday objects). You will be given the plan, the class and topic it was for, and the teaching passages it was supposed to be grounded in. Score 1-5 on each:
- faithfulness: the plan's specific claims, examples and activity are consistent with the passages and do not contradict them. General pedagogy that the passages do not mention is fine; contradictions or invented "facts" attributed to the material are not. If no passages were given, judge only that the plan does not claim to cite sources.
- gradeFit: language, examples and difficulty suit the stated class (Class 1 = age ~6, Class 5 = age ~10).
- lowResource: the activity is doable with chalk, a board and everyday objects; no printed sheets, screens or purchased kits.
- completeness: has a learning objective, key concepts, a simple explanation, one hands-on activity, and three quiz questions with answers.
List concrete issues (quote the offending line briefly). verdict is "pass" only if every score is 4 or 5.
Reply with JSON only: {"faithfulness":n,"gradeFit":n,"lowResource":n,"completeness":n,"issues":["..."],"verdict":"pass"|"fail"}.`;

async function judge({ query, plan, chunks, usage }) {
  const user = JSON.stringify({
    request: { topic: query.topic, subject: query.subject, grade: query.grade },
    passages: chunks.map((c) => ({ source: c.title, text: c.text.slice(0, 1200) })),
    plan
  });
  const messages = [
    { role: 'system', content: judgeSystem },
    { role: 'user', content: user }
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await chatWithRetry({
      model: JUDGE_MODEL,
      messages,
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });
    usage.judgePromptTokens += completion.usage?.prompt_tokens || 0;
    usage.judgeCompletionTokens += completion.usage?.completion_tokens || 0;
    const raw = completion.choices[0].message.content || '';
    try {
      return JudgeSchema.parse(JSON.parse(raw));
    } catch (err) {
      if (attempt === 1) throw new Error(`judge output invalid: ${err.message.slice(0, 200)}`);
      messages.push({ role: 'assistant', content: raw });
      messages.push({ role: 'user', content: 'That was not valid JSON for the schema. Reply again with only the corrected JSON.' });
    }
  }
  throw new Error('unreachable');
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f2 = (x) => x.toFixed(2);

async function main() {
  await connectDB();
  const started = Date.now();

  const wanted = IDS || DEFAULT_IDS.slice(0, LIMIT);
  const queries = wanted.map((id) => golden.queries.find((q) => q.id === id)).filter(Boolean);
  if (queries.length === 0) {
    console.error('No golden queries matched.');
    process.exit(1);
  }

  console.log(`Generation eval: ${queries.length} queries. Generator: ${CHAT_PROVIDER}/${CHAT_MODEL}. Judge: ${JUDGE_MODEL}${JUDGE_MODEL === CHAT_MODEL ? ' (same model — self-judging, see README)' : ''}.\n`);

  const usage = { judgePromptTokens: 0, judgeCompletionTokens: 0 };
  const rows = [];

  for (const q of queries) {
    const t0 = Date.now();
    const row = { id: q.id, kind: q.kind, topic: q.topic, grade: q.grade };
    try {
      const gen = await generateLessonPlan({ topic: q.topic, subject: q.subject, grade: q.grade });
      row.sources = gen.sources.length;
      row.structure = structuralChecks(gen.lessonPlan);
      row.planExcerpt = gen.lessonPlan.slice(0, 1500); // enough to audit a verdict later
      row.judge = await judge({ query: q, plan: gen.lessonPlan, chunks: gen.contextChunks, usage });
      row.pass = row.judge.verdict === 'pass' && row.structure.hasAllSections && !row.structure.mentionsPrintedMaterials;
      row.durationMs = Date.now() - t0;

      const j = row.judge;
      console.log(
        `${row.pass ? 'PASS' : 'FAIL'}  ${q.id.padEnd(14)} ${q.grade.padEnd(8)} sources=${row.sources}  ` +
          `faith ${j.faithfulness} grade ${j.gradeFit} lowres ${j.lowResource} complete ${j.completeness}  ` +
          `words=${row.structure.words}${row.structure.missingSections.length ? ` missing=[${row.structure.missingSections}]` : ''}` +
          `${row.structure.mentionsPrintedMaterials ? ' PRINTED-MATERIALS' : ''}  ${row.durationMs}ms`
      );
      for (const issue of j.issues.slice(0, 3)) console.log(`        · ${issue}`);
      if (row.structure.printedMatch) console.log(`        · printed-materials match: "…${row.structure.printedMatch}…"`);
    } catch (err) {
      row.error = err.message;
      row.pass = false;
      console.log(`ERR   ${q.id.padEnd(14)} ${err.message.slice(0, 160)}`);
    }
    rows.push(row);
  }

  const judged = rows.filter((r) => r.judge);
  const metrics = {
    queries: rows.length,
    errors: rows.filter((r) => r.error).length,
    passRate: mean(rows.map((r) => (r.pass ? 1 : 0))),
    faithfulness: mean(judged.map((r) => r.judge.faithfulness)),
    gradeFit: mean(judged.map((r) => r.judge.gradeFit)),
    lowResource: mean(judged.map((r) => r.judge.lowResource)),
    completeness: mean(judged.map((r) => r.judge.completeness)),
    structureOk: mean(rows.filter((r) => r.structure).map((r) => (r.structure.hasAllSections ? 1 : 0))),
    groundedRate: mean(rows.filter((r) => r.sources !== undefined).map((r) => (r.sources > 0 ? 1 : 0)))
  };

  console.log(
    `\n== pass ${(metrics.passRate * 100).toFixed(0)}%   faithfulness ${f2(metrics.faithfulness)}   gradeFit ${f2(metrics.gradeFit)}   ` +
      `lowResource ${f2(metrics.lowResource)}   completeness ${f2(metrics.completeness)}   structure ok ${(metrics.structureOk * 100).toFixed(0)}%   ` +
      `grounded ${(metrics.groundedRate * 100).toFixed(0)}%`
  );
  console.log(`   judge tokens: ${usage.judgePromptTokens + usage.judgeCompletionTokens}`);

  if (SAVE) {
    const prev = await EvalRun.findOne({ kind: 'generation' }).sort({ createdAt: -1 }).lean();
    if (prev) {
      const d = (k) => `${prev.metrics[k] !== undefined ? (metrics[k] - prev.metrics[k] >= 0 ? '+' : '') + f2(metrics[k] - prev.metrics[k]) : 'n/a'}`;
      console.log(
        `   vs last run (${new Date(prev.createdAt).toLocaleString('en-IN')}, ${prev.config.generator}): pass ${d('passRate')}, faithfulness ${d('faithfulness')}, gradeFit ${d('gradeFit')}, lowResource ${d('lowResource')}`
      );
    }
    await EvalRun.create({
      kind: 'generation',
      config: { generator: `${CHAT_PROVIDER}/${CHAT_MODEL}`, judge: JUDGE_MODEL, ids: queries.map((q) => q.id) },
      metrics,
      perQuery: rows,
      durationMs: Date.now() - started
    });
  }
  console.log(`\n${SAVE ? 'Saved.' : 'Not saved (--no-save).'} ${Date.now() - started}ms.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
