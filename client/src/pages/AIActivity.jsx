import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import StatStrip from '../components/StatStrip';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Table, { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { aiAdminAPI } from '../utils/api';
import { formatStamp } from '../utils/session';

/**
 * Coordinator's view of the AI features. Three questions it answers:
 *   What has the agent been asked, and what did it look up to answer?
 *   Are volunteers accepting the drafted plans — and when not, why?
 *   Are retrieval and generation getting better or worse over time?
 * Everything shown is read from the audit rows the features write.
 */

const TOOL_LABELS = {
  search_teaching_resources: 'Teaching resources',
  draft_lesson_plan: 'Lesson plan',
  get_student_progress: 'Student lookup',
  find_students_needing_attention: 'Attention scan',
  list_sessions: 'Sessions',
  get_my_teaching_history: 'Own record',
  get_volunteer_stats: 'Volunteer stats',
};

const STATUS_VARIANT = { completed: 'recorded', max_iterations: 'live', error: 'blocked' };
const pct = (x) => (x === undefined || x === null ? '—' : `${Math.round(x * 100)}%`);
const num = (x) => (x === undefined || x === null ? '—' : x.toLocaleString());
const secs = (ms) => (ms ? `${(ms / 1000).toFixed(1)}s` : '—');

function SectionTitle({ children, note }) {
  return (
    <div className="mb-3 mt-8 flex items-baseline justify-between gap-3">
      <h2 className="type-title text-[17px] text-ink">{children}</h2>
      {note && <p className="text-[13px] text-ink-3">{note}</p>}
    </div>
  );
}

function RunDetail({ id, onClose }) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await aiAdminAPI.run(id);
        if (!cancelled) setRun(res.data.data);
      } catch {
        if (!cancelled) setError('This run could not be loaded.');
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="mt-3 rounded-lg border border-rule bg-paper px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-ink-2">Full trace</p>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      {error && <p className="mt-2 text-[13px] text-brick">{error}</p>}
      {!run && !error && <p className="mt-2 text-[13px] text-ink-3">Loading…</p>}
      {run && (
        <div className="mt-2 space-y-3">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-ink-3">Question</p>
            <p className="text-sm text-ink">{run.question}</p>
          </div>
          {run.steps?.length > 0 && (
            <div>
              <p className="text-[12px] uppercase tracking-wide text-ink-3">Steps</p>
              <ol className="mt-1 space-y-2">
                {run.steps.map((s, i) => (
                  <li key={i} className="rounded-md border border-rule bg-surface px-3 py-2 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-ink-3">{i + 1}</span>
                      <span className={s.ok ? 'text-ink' : 'text-brick'}>{s.tool}{s.ok ? '' : ' — failed'}</span>
                      <span className="font-mono text-ink-3">{s.durationMs}ms · turn {s.iteration}</span>
                    </div>
                    {s.args && <p className="mt-1 break-all font-mono text-[12px] text-ink-2">{JSON.stringify(s.args)}</p>}
                    {s.error && <p className="mt-1 text-[12px] text-brick">{s.error}</p>}
                    {s.resultPreview && <p className="mt-1 break-all font-mono text-[12px] text-ink-3">{s.resultPreview}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div>
            <p className="text-[12px] uppercase tracking-wide text-ink-3">Answer</p>
            <p className="whitespace-pre-wrap text-sm text-ink">{run.answer || <span className="text-ink-3">(none)</span>}</p>
            {run.error && <p className="mt-1 text-[13px] text-brick">{run.error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIActivity() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openRun, setOpenRun] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await aiAdminAPI.activity();
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'AI activity could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) return <Layout><LoadingState label="Reading the audit trail" /></Layout>;

  const a = data?.agent;
  const p = data?.prep;
  const e = data?.evals;
  const approvalRate = p?.reviewed ? p.approved / p.reviewed : null;

  return (
    <Layout>
      <PageHeader
        title="AI activity"
        lede="What the assistant was asked and what it looked up, how volunteers judged the drafted plans, and how the evals are trending. Read from the audit trail, not sampled."
        actions={<Button variant="secondary" size="sm" onClick={load} disabled={loading}>{loading ? 'Refreshing' : 'Refresh'}</Button>}
      />

      {error && (
        <div role="alert" className="mb-6 rounded-md border border-brick-line bg-brick-wash px-3.5 py-3">
          <p className="text-[13px] text-brick">{error}</p>
        </div>
      )}

      {data && (
        <>
          <p className="mb-4 text-[13px] text-ink-3">
            Chat {data.config.chat} · embeddings {data.config.embeddings} · retrieval {data.config.retrievalMode} ·
            budget {num(data.config.dailyTokenBudgetPerUser)} tokens/person/day · limit {data.config.rateLimit.requests} requests per {data.config.rateLimit.windowMinutes} min
          </p>

          <StatStrip
            items={[
              { label: 'Questions, last 7 days', value: num(a.last7Days.runs), note: `${a.last7Days.today} today` },
              { label: 'Tokens, last 7 days', value: num(a.last7Days.tokens), note: `${a.last7Days.avgIterations} turns, ${a.last7Days.avgSteps} lookups per question` },
              { label: 'Time to answer', value: secs(a.last7Days.avgDurationMs), note: `${secs(a.last7Days.avgLlmMs)} of it in the model` },
              {
                label: 'Plans approved',
                value: pct(approvalRate),
                note: p.reviewed ? `${p.approved} of ${p.reviewed} reviewed, ${p.editedBeforeReview} edited first` : 'none reviewed yet',
                accent: approvalRate !== null && approvalRate < 0.6,
              },
            ]}
          />

          {/* ---- Agent ---- */}
          <SectionTitle note={Object.entries(a.last7Days.byStatus).map(([k, v]) => `${v} ${k.replace('_', ' ')}`).join(' · ')}>
            Recent questions
          </SectionTitle>
          {a.recent.length === 0 ? (
            <EmptyState title="Nobody has asked anything yet" description="Questions put to Ask appear here with the tools the assistant used." />
          ) : (
            <div className="rounded-lg border border-rule bg-surface">
              <Table minWidth={860}>
                <TableHead>
                  <TableRow>
                    <TableHeader>When</TableHeader>
                    <TableHeader>Who</TableHeader>
                    <TableHeader>Question</TableHeader>
                    <TableHeader>Looked up</TableHeader>
                    <TableHeader className="text-right">Turns</TableHeader>
                    <TableHeader className="text-right">Tokens</TableHeader>
                    <TableHeader className="text-right">Time</TableHeader>
                    <TableHeader>Status</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {a.recent.map((r) => (
                    <TableRow key={r.id} onClick={() => setOpenRun(openRun === r.id ? null : r.id)} className="cursor-pointer">
                      <TableCell className="whitespace-nowrap text-ink-2">{formatStamp(r.at)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.user}<span className="text-ink-3"> · {r.role}</span></TableCell>
                      <TableCell><span className="line-clamp-2 max-w-[34ch]">{r.question}</span></TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          {r.tools.length === 0 && <span className="text-ink-3">nothing</span>}
                          {r.tools.map((t, i) => (
                            <Badge key={i} variant={t.ok ? 'quiet' : 'blocked'}>{TOOL_LABELS[t.tool] || t.tool}</Badge>
                          ))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.iterations}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.tokens)}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{secs(r.durationMs)}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[r.status] || 'default'}>{r.status.replace('_', ' ')}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {openRun && <RunDetail id={openRun} onClose={() => setOpenRun(null)} />}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <SectionTitle>Tools used, last 7 days</SectionTitle>
              {a.tools.length === 0 ? (
                <p className="text-[13px] text-ink-3">No tool calls yet.</p>
              ) : (
                <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
                  {a.tools.map((t) => (
                    <li key={t.tool} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span>{TOOL_LABELS[t.tool] || t.tool}<span className="font-mono text-[12px] text-ink-3"> {t.tool}</span></span>
                      <span className="tabular-nums text-ink-2">
                        {t.calls} {t.calls === 1 ? 'call' : 'calls'}{t.failures ? <span className="text-brick"> · {t.failures} failed</span> : ''} · {t.avgMs}ms
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <SectionTitle>Spend today, by person</SectionTitle>
              {a.spendToday.length === 0 ? (
                <p className="text-[13px] text-ink-3">Nothing spent today.</p>
              ) : (
                <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
                  {a.spendToday.map((u) => {
                    const share = u.tokens / data.config.dailyTokenBudgetPerUser;
                    return (
                      <li key={u.name} className="px-4 py-2.5 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span>{u.name}<span className="text-ink-3"> · {u.runs} {u.runs === 1 ? 'question' : 'questions'}</span></span>
                          <span className={`tabular-nums ${share >= 0.9 ? 'text-brick' : 'text-ink-2'}`}>{num(u.tokens)} · {pct(share)} of budget</span>
                        </div>
                        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-rule">
                          <div className={`h-full rounded-full ${share >= 0.9 ? 'bg-brick' : 'bg-board'}`} style={{ width: `${Math.min(100, share * 100)}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ---- Prep ---- */}
          <SectionTitle note={Object.entries(p.byStatus).map(([k, v]) => `${v} ${k}`).join(' · ') || undefined}>
            Session-prep reviews
          </SectionTitle>
          {p.rejections.length === 0 ? (
            <p className="text-[13px] text-ink-3">
              No rejected drafts{p.reviewed ? ` — ${p.approved} approved, ${p.editedBeforeReview} edited before approval.` : ' yet.'}
            </p>
          ) : (
            <div className="rounded-lg border border-rule bg-surface">
              <p className="border-b border-rule px-4 py-2.5 text-[13px] text-ink-2">
                Why volunteers rejected drafts — the raw material for improving the planner.
              </p>
              <ul className="divide-y divide-rule">
                {p.rejections.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <p className="text-sm text-ink">“{r.reason}”</p>
                    <p className="mt-1 text-[12px] text-ink-3">
                      {r.volunteer} · {r.session} · {formatStamp(r.at)} · {r.groups.join('; ')}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ---- Evals ---- */}
          <SectionTitle note="npm run eval:retrieval · npm run eval:generation">Eval history</SectionTitle>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-rule bg-surface">
              <p className="border-b border-rule px-4 py-2.5 text-[13px] text-ink-2">Retrieval — golden set</p>
              {e.retrieval.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-ink-3">No runs yet.</p>
              ) : (
                <Table minWidth={420}>
                  <TableHead>
                    <TableRow>
                      <TableHeader>When</TableHeader>
                      <TableHeader>Mode</TableHeader>
                      <TableHeader className="text-right">Thr.</TableHeader>
                      <TableHeader className="text-right">Recall</TableHeader>
                      <TableHeader className="text-right">Prec.</TableHeader>
                      <TableHeader className="text-right">MRR</TableHeader>
                      <TableHeader className="text-right">False+</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {e.retrieval.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-ink-2">{formatStamp(r.at)}</TableCell>
                        <TableCell>{r.mode}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.threshold}</TableCell>
                        <TableCell className={`text-right tabular-nums ${r.recall < 0.9 ? 'text-brick' : ''}`}>{pct(r.recall)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(r.precision)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.mrr?.toFixed(2)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${r.falsePositives ? 'text-brick' : ''}`}>{r.falsePositives}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="rounded-lg border border-rule bg-surface">
              <p className="border-b border-rule px-4 py-2.5 text-[13px] text-ink-2">Generation — LLM judge (1–5) + structure checks</p>
              {e.generation.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-ink-3">No runs yet.</p>
              ) : (
                <Table minWidth={420}>
                  <TableHead>
                    <TableRow>
                      <TableHeader>When</TableHeader>
                      <TableHeader className="text-right">Pass</TableHeader>
                      <TableHeader className="text-right">Faith.</TableHeader>
                      <TableHeader className="text-right">Grade</TableHeader>
                      <TableHeader className="text-right">Low-res.</TableHeader>
                      <TableHeader className="text-right">Complete</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {e.generation.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="whitespace-nowrap text-ink-2">{formatStamp(g.at)}<span className="text-ink-3"> · {g.queries} q</span></TableCell>
                        <TableCell className={`text-right tabular-nums ${g.passRate < 1 ? 'text-brick' : ''}`}>{pct(g.passRate)}</TableCell>
                        <TableCell className="text-right tabular-nums">{g.faithfulness?.toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{g.gradeFit?.toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{g.lowResource?.toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{g.completeness?.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
