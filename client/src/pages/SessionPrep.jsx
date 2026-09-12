import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Prose from '../components/Prose';
import Badge from '../components/Badge';
import LoadingState from '../components/LoadingState';
import { Textarea } from '../components/Input';
import { prepAPI, attendanceSessionAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatDay, formatTime } from '../utils/session';

/**
 * The human half of the session-prep workflow.
 *
 * The server drafts; nothing here is final until the volunteer approves it.
 * They can edit the text of each block first, or reject the whole draft with
 * a reason. The "why this group" rationale and the sources stay visible so
 * the reasoning can be judged, not just the output.
 */

const STATUS = {
  draft: { label: 'Draft — needs your review', variant: 'live' },
  approved: { label: 'Approved', variant: 'recorded' },
  rejected: { label: 'Rejected', variant: 'blocked' },
};

const STEP_LABELS = {
  gather: 'Read your teaching record and flagged students',
  plan: 'Chose focus groups',
  retrieve: "Searched the club's teaching resources",
  write: 'Wrote the teaching blocks',
};

function Steps({ trace, durationMs, usage, generatedBy }) {
  const [open, setOpen] = useState(false);
  const tokens = (usage?.promptTokens || 0) + (usage?.completionTokens || 0);
  return (
    <div className="rounded-lg border border-rule bg-surface px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-[12px] text-ink-3 hover:text-ink"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          <path d="M9 6l6 6-6 6" />
        </svg>
        How this draft was made
        <span className="text-ink-3/70">
          · {(durationMs / 1000).toFixed(1)}s{tokens > 0 && ` · ${tokens.toLocaleString()} tokens`}
          {generatedBy?.model && ` · ${generatedBy.model}`}
        </span>
      </button>
      {open && (
        <ol className="mt-2.5 space-y-1.5">
          {trace.map((t, i) => (
            <li key={i} className="flex gap-3 text-[12px]">
              <span className="w-4 shrink-0 text-right font-mono text-ink-3 tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-ink">{STEP_LABELS[t.step] || t.step}</span>
                {t.detail && <span className="block text-ink-3">{t.detail}</span>}
              </span>
              <span className="shrink-0 font-mono text-ink-3 tabular-nums">{t.durationMs}ms</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function GroupCard({ group, index, editing, draftEdits, onEdit }) {
  const e = draftEdits[index] || {};
  const field = (key) => (e[key] !== undefined ? e[key] : group[key]);
  const questions = e.checkQuestions !== undefined ? e.checkQuestions : group.checkQuestions.join('\n');

  return (
    <article className="rounded-lg border border-rule bg-surface">
      <header className="border-b border-rule px-4 py-3.5 sm:px-5">
        <p className="text-[12px] uppercase tracking-wide text-ink-3">
          Group {index + 1} · {group.grade} · {group.subject}
        </p>
        {editing ? (
          <input
            value={field('topic')}
            onChange={(ev) => onEdit(index, 'topic', ev.target.value)}
            aria-label="Topic"
            className="mt-1 w-full rounded-md border border-rule-strong bg-surface px-2.5 py-1.5 type-title text-[17px] text-ink focus:border-board focus:outline-none"
          />
        ) : (
          <h2 className="type-title text-[17px] text-ink">{group.topic}</h2>
        )}
        <p className="mt-1.5 text-[13px] text-ink-2">
          {group.students.map((s) =>
            s.studentId ? (
              <Link key={s.name} to={`/students/${s.studentId}`} className="underline underline-offset-4 decoration-rule-strong hover:decoration-ink">
                {s.name}
              </Link>
            ) : (
              <span key={s.name}>{s.name}</span>
            )
          ).reduce((acc, el, i) => (i === 0 ? [el] : [...acc, ', ', el]), [])}
        </p>
        {group.rationale && (
          <p className="mt-2 rounded-md bg-paper px-3 py-2 text-[13px] text-ink-2">
            <span className="font-medium text-ink">Why this group: </span>
            {group.rationale}
          </p>
        )}
      </header>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <Section label="Objective" editing={editing} value={field('objective')} rows={2} onChange={(v) => onEdit(index, 'objective', v)} />
        <Section label="Activity" editing={editing} value={field('activity')} rows={8} onChange={(v) => onEdit(index, 'activity', v)} />
        <Section
          label="Check questions"
          hint={editing ? 'One per line.' : undefined}
          editing={editing}
          value={questions}
          rows={4}
          onChange={(v) => onEdit(index, 'checkQuestions', v)}
          render={(v) => (
            <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-ink">
              {group.checkQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          )}
        />
      </div>

      <footer className="border-t border-rule px-4 py-3 sm:px-5">
        {group.sources?.length > 0 ? (
          <p className="text-[12px] text-ink-3">
            Built on:{' '}
            {group.sources.map((s, i) => (
              <span key={i}>
                {i > 0 && '; '}
                {s.label} <span className="font-mono tabular-nums">{Math.round(s.similarity * 100)}%</span>
              </span>
            ))}
          </p>
        ) : (
          <p className="text-[12px] text-ink-3">No matching teaching resource in the library — written from general practice. Read it with extra care.</p>
        )}
      </footer>
    </article>
  );
}

function Section({ label, hint, editing, value, rows, onChange, render }) {
  return (
    <div>
      <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-3">{label}</p>
      {editing ? (
        <Textarea value={value} rows={rows} hint={hint} onChange={(ev) => onChange(ev.target.value)} aria-label={label} />
      ) : render ? (
        render(value)
      ) : (
        <Prose text={value} />
      )}
    </div>
  );
}

export default function SessionPrep() {
  const { sessionId } = useParams();
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState({});
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, d] = await Promise.all([attendanceSessionAPI.getOne(sessionId), prepAPI.getForSession(sessionId)]);
        if (cancelled) return;
        setSession(s.data.data);
        setDraft(d.data.data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'This session could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const run = async (label, fn, doneMessage) => {
    setWorking(label);
    setError('');
    try {
      const res = await fn();
      setDraft(res.data.data);
      if (doneMessage) toast.done(doneMessage);
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'That did not go through. Try again in a moment.';
      setError(msg);
      return false;
    } finally {
      setWorking('');
    }
  };

  const prepare = (force) =>
    run('prepare', () => prepAPI.prepare(sessionId, force), force ? 'A fresh draft is ready.' : 'Your draft is ready.');

  const onEdit = (index, key, value) =>
    setEdits((prev) => ({ ...prev, [index]: { ...(prev[index] || {}), [key]: value } }));

  const saveEdits = async () => {
    const payload = draft.focusGroups.map((g, i) => {
      const e = edits[i] || {};
      return {
        topic: e.topic,
        objective: e.objective,
        activity: e.activity,
        checkQuestions: e.checkQuestions !== undefined ? e.checkQuestions.split('\n').map((q) => q.trim()).filter(Boolean) : undefined,
      };
    });
    const ok = await run('save', () => prepAPI.edit(draft._id, payload), 'Changes saved.');
    if (ok) { setEditing(false); setEdits({}); }
  };

  const approve = () => run('approve', () => prepAPI.approve(draft._id), 'Approved. This is your plan for the session.');
  const reject = async () => {
    const ok = await run('reject', () => prepAPI.reject(draft._id, reason), 'Draft rejected. You can ask for a fresh one.');
    if (ok) { setRejecting(false); setReason(''); }
  };

  if (loading) return <Layout><LoadingState label="Loading your plan" /></Layout>;

  const status = draft ? STATUS[draft.status] : null;
  const isDraft = draft?.status === 'draft';
  const canPrepare = session && new Date(session.endTime) > new Date();

  return (
    <Layout>
      <PageHeader
        title="Session prep"
        lede={
          session
            ? `${session.title} — ${formatDay(session.startTime)}, ${formatTime(session.startTime)} to ${formatTime(session.endTime)}. A plan drafted from what you and the club have taught so far. Nothing is final until you approve it.`
            : undefined
        }
        actions={
          <>
            <Link to="/volunteer-sessions" className="text-[13px] text-ink-2 underline underline-offset-4 decoration-rule-strong hover:text-ink self-center">
              All sessions
            </Link>
            {draft && canPrepare && !isDraft && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => prepare(true)}
                loading={working === 'prepare'}
                disabled={!!working}
              >
                {working === 'prepare' ? 'Drafting' : 'Draft a fresh plan'}
              </Button>
            )}
          </>
        }
      >
        {status && <Badge variant={status.variant} className="mb-2">{status.label}</Badge>}
      </PageHeader>

      {error && (
        <div role="alert" className="mb-6 rounded-md border border-brick-line bg-brick-wash px-3.5 py-3">
          <p className="text-[13px] text-brick">{error}</p>
        </div>
      )}

      {!draft && (
        <div className="rounded-lg border border-dashed border-rule-strong bg-surface px-6 py-14 text-center">
          <h2 className="type-title text-[15px] text-ink">No plan yet</h2>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-sm text-ink-2">
            The planner reads which children you have taught, what they scored, and who the club has not seen lately, then drafts two or three focus groups with a hands-on activity each.
          </p>
          {canPrepare ? (
            <Button
              className="mt-5"
              onClick={() => prepare(false)}
              loading={working === 'prepare'}
              disabled={!!working}
            >
              {working === 'prepare' ? 'Drafting — about ten seconds' : 'Draft my plan'}
            </Button>
          ) : (
            <p className="mt-4 text-[13px] text-ink-3">This session has ended.</p>
          )}
        </div>
      )}

      {working === 'prepare' && draft && (
        <div className="mb-4 rounded-lg border border-rule bg-surface px-4 py-3 text-[13px] text-ink-2">Drafting a fresh plan…</div>
      )}

      {draft && (
        <div className="space-y-4">
          {draft.reviewNote && (
            <div className={`rounded-lg border px-4 py-3 text-[13px] ${draft.status === 'rejected' ? 'border-brick-line bg-brick-wash text-brick' : 'border-teal-line bg-teal-wash text-teal'}`}>
              <span className="font-medium">{draft.status === 'rejected' ? 'Why you rejected it: ' : 'Your note: '}</span>
              {draft.reviewNote}
            </div>
          )}

          {draft.focusGroups.map((g, i) => (
            <GroupCard key={i} group={g} index={i} editing={editing && isDraft} draftEdits={edits} onEdit={onEdit} />
          ))}

          <Steps trace={draft.trace || []} durationMs={draft.durationMs} usage={draft.usage} generatedBy={draft.generatedBy} />

          {isDraft && (
            <div className="sticky bottom-0 -mx-4 border-t border-rule bg-paper px-4 py-3 sm:mx-0 sm:rounded-lg sm:border">
              {!rejecting ? (
                <div className="flex flex-wrap items-center gap-2">
                  {editing ? (
                    <>
                      <Button onClick={saveEdits} loading={working === 'save'} disabled={!!working}>{working === 'save' ? 'Saving' : 'Save changes'}</Button>
                      <Button variant="ghost" onClick={() => { setEditing(false); setEdits({}); }} disabled={!!working}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={approve} loading={working === 'approve'} disabled={!!working}>{working === 'approve' ? 'Approving' : 'Approve — I will teach this'}</Button>
                      <Button variant="secondary" onClick={() => setEditing(true)} disabled={!!working}>Edit first</Button>
                      <Button variant="ghost" onClick={() => setRejecting(true)} disabled={!!working}>Reject</Button>
                    </>
                  )}
                  <p className="ml-auto text-[12px] text-ink-3">
                    {draft.editedByVolunteer ? 'Edited by you. ' : ''}Read it through before approving — it is a starting point, not a script.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Textarea
                      label="Why does this draft not work?"
                      value={reason}
                      onChange={(ev) => setReason(ev.target.value)}
                      rows={2}
                      placeholder="Wrong students, topic already covered, too advanced for Class 1…"
                      hint="Kept with the draft so the planner can be improved."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="danger" onClick={reject} loading={working === 'reject'} disabled={!!working || !reason.trim()}>{working === 'reject' ? 'Rejecting' : 'Reject draft'}</Button>
                    <Button variant="ghost" onClick={() => { setRejecting(false); setReason(''); }} disabled={!!working}>Back</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
