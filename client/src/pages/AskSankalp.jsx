import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { aiAPI } from '../utils/api';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Prose from '../components/Prose';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Openers that show off what the agent can reach, chosen per role so a
// volunteer is never nudged toward a question their tools cannot answer.
const VOLUNTEER_PROMPTS = [
  'What did I teach last time, and what should I revise this Saturday?',
  'Which Class 4 students have not been taught in three weeks?',
  'How is Aarti doing in Math?',
  'Give me a hands-on activity for fractions, Class 5, no printed sheets.',
];

const ADMIN_PROMPTS = [
  'Which volunteers have gone quiet this month?',
  'Who are the students we have missed for three weeks or more?',
  'How did last Saturday go — lessons, students, volunteers?',
  'Who taught the most lessons in the last 30 days?',
];

// Human labels for the tool names in the trace.
const TOOL_LABELS = {
  search_teaching_resources: 'Searched teaching resources',
  draft_lesson_plan: 'Drafted a lesson plan',
  get_student_progress: 'Looked up a student',
  find_students_needing_attention: 'Scanned for students needing attention',
  list_sessions: 'Listed sessions',
  get_my_teaching_history: 'Read your teaching record',
  get_volunteer_stats: 'Checked volunteer activity',
};

const summariseArgs = (args) => {
  if (!args || typeof args !== 'object') return '';
  return Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(' · ');
};

function Trace({ steps, iterations, durationMs, llmMs, usage }) {
  const [open, setOpen] = useState(false);
  const tokens = (usage?.promptTokens || 0) + (usage?.completionTokens || 0);

  return (
    <div className="mt-3 border-t border-rule pt-2.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 text-[12px] text-ink-3 hover:text-ink"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        {steps.length === 0
          ? 'Answered without looking anything up'
          : `Looked up ${steps.length} ${steps.length === 1 ? 'thing' : 'things'}`}
        <span className="text-ink-3/70">
          · {iterations} {iterations === 1 ? 'step' : 'steps'} · {(durationMs / 1000).toFixed(1)}s
          {llmMs > 0 && ` (model ${(llmMs / 1000).toFixed(1)}s)`}
          {tokens > 0 && ` · ${tokens.toLocaleString()} tokens`}
        </span>
      </button>

      {open && steps.length > 0 && (
        <ol className="mt-2.5 space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-[12px]">
              <span className="shrink-0 w-4 text-right font-mono text-ink-3 tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block ${step.ok ? 'text-ink' : 'text-brick'}`}>
                  {TOOL_LABELS[step.tool] || step.tool}
                  {!step.ok && ' — failed'}
                </span>
                {summariseArgs(step.args) && (
                  <span className="block font-mono text-ink-3 break-words">
                    {summariseArgs(step.args)}
                  </span>
                )}
                {step.error && (
                  <span className="block text-brick/80">{step.error}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-ink-3 tabular-nums">
                {step.durationMs}ms
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const relative = (iso) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days === 0) return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/**
 * Past conversations. Everything shown here is read back from the server, so
 * a refresh, another device, or a week later all look the same.
 */
function History({ items, activeId, onOpen, onNew, onDelete, loading }) {
  const [confirming, setConfirming] = useState(null);
  return (
    <aside className="rounded-lg border border-rule bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3.5 py-2.5">
        <p className="text-[13px] font-medium text-ink">History</p>
        <Button variant="ghost" size="sm" onClick={onNew} disabled={!activeId}>New</Button>
      </div>
      {loading && items.length === 0 ? (
        <p className="px-3.5 py-3 text-[13px] text-ink-3">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-3.5 py-3 text-[13px] text-ink-3">Your questions will be kept here.</p>
      ) : (
        <ul className="max-h-[60vh] divide-y divide-rule overflow-y-auto">
          {items.map((c) => {
            const active = c.id === activeId;
            return (
              <li key={c.id} className={active ? 'bg-paper' : ''}>
                <div className="flex items-start gap-1 px-3.5 py-2.5">
                  <button
                    type="button"
                    onClick={() => onOpen(c.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-current={active ? 'true' : undefined}
                  >
                    <span className={`block truncate text-[13px] ${active ? 'font-medium text-ink' : 'text-ink'}`}>{c.title}</span>
                    <span className="block text-[12px] text-ink-3">
                      {relative(c.lastAt)} · {c.turns} {c.turns === 1 ? 'question' : 'questions'}
                    </span>
                  </button>
                  {confirming === c.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => { onDelete(c.id); setConfirming(null); }} className="text-[12px] text-brick hover:underline">Delete</button>
                      <button type="button" onClick={() => setConfirming(null)} className="text-[12px] text-ink-3 hover:underline">Keep</button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(c.id)}
                      aria-label={`Delete conversation: ${c.title}`}
                      className="shrink-0 rounded px-1 text-[16px] leading-none text-ink-3 hover:bg-paper-deep hover:text-ink"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export default function AskSankalp() {
  const { isAdmin, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get('c');
  const toast = useToast();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');
  // What is happening right now, while an answer streams in.
  const [live, setLive] = useState({ text: '', status: '', steps: [] });
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const prompts = isAdmin ? ADMIN_PROMPTS : VOLUNTEER_PROMPTS;

  const loadHistory = async () => {
    try {
      const res = await aiAPI.conversations();
      setHistory(res.data.data || []);
    } catch {
      /* the list is a convenience; asking still works without it */
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  // The conversation lives in the URL, so a refresh (or a shared link to
  // yourself) brings it back from the server.
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return undefined;
    }
    let cancelled = false;
    setRestoring(true);
    setError('');
    (async () => {
      try {
        const res = await aiAPI.conversation(conversationId);
        if (!cancelled) setMessages(res.data.data.messages);
      } catch (err) {
        if (cancelled) return;
        // Someone else's, or deleted: start clean rather than show an error wall.
        setSearchParams({}, { replace: true });
        if (err.response?.status !== 404) setError('That conversation could not be loaded.');
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  // Smooth scrolling is for a new message landing. While an answer streams,
  // this fires on every token, and dozens of overlapping smooth scrolls make
  // the page crawl — so jump instantly until the stream is done.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth', block: 'end' });
  }, [messages, loading, live.text, live.status]);

  const startNew = () => {
    setSearchParams({}, { replace: true });
    setMessages([]);
    setError('');
    inputRef.current?.focus();
  };

  const openConversation = (id) => {
    if (id !== conversationId) setSearchParams({ c: id });
  };

  const deleteConversation = async (id) => {
    try {
      await aiAPI.deleteConversation(id);
      setHistory((h) => h.filter((c) => c.id !== id));
      if (id === conversationId) startNew();
      toast.done('Conversation deleted.');
    } catch {
      toast.blocked('That conversation could not be deleted.');
    }
  };

  const ask = async (text) => {
    const question = text.trim();
    if (!question || loading) return;

    const next = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setInput('');
    setError('');
    setLoading(true);
    setLive({ text: '', status: 'Thinking', steps: [] });

    try {
      // Only the new question goes up. The server owns the transcript and
      // re-runs the tools fresh for every question.
      const payload = conversationId ? { conversationId, question } : { question };

      // Stream when we can — tool steps and the answer appear as they happen.
      // If the stream endpoint is unreachable (an old server, a proxy that
      // strips streams), fall back to the plain request; same answer, later.
      let result;
      try {
        result = await aiAPI.askStream(payload, (event) => {
          if (event.type === 'token') {
            setLive((l) => ({ ...l, text: l.text + event.text, status: '' }));
          } else if (event.type === 'retract') {
            setLive((l) => ({ ...l, text: '' }));
          } else if (event.type === 'tool_start') {
            setLive((l) => ({ ...l, status: TOOL_LABELS[event.tool] || event.tool, steps: [...l.steps, event.tool] }));
          } else if (event.type === 'tool_end') {
            setLive((l) => ({ ...l, status: 'Thinking' }));
          }
        });
      } catch (streamErr) {
        // A guardrail (429) or validation (400) is a real answer, not a
        // transport problem — surface it rather than retrying without a stream.
        if (streamErr.status) throw streamErr;
        const { data } = await aiAPI.ask(payload);
        result = data.data;
      }

      setMessages([
        ...next,
        {
          role: 'assistant',
          content: result.answer,
          status: result.status,
          trace: {
            steps: result.steps || [],
            iterations: result.iterations,
            durationMs: result.durationMs,
            llmMs: result.llmMs,
            usage: result.usage,
          },
        },
      ]);
      // First answer of a new conversation: pin its id to the URL so a
      // refresh restores it, and show it in the history list.
      if (result.conversationId && result.conversationId !== conversationId) {
        setSearchParams({ c: result.conversationId }, { replace: true });
      }
      loadHistory();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'That did not go through. Try again in a moment.');
      // Leave the question in the box so it is not lost.
      setInput(question);
      setMessages(messages);
    } finally {
      setLoading(false);
      setLive({ text: '', status: '', steps: [] });
      inputRef.current?.focus();
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    ask(input);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Ask"
        lede="Ask about students, sessions, your own record or how to teach a topic. It answers from the club's records, shows what it looked up, and keeps your conversations."
        actions={
          messages.length > 0 && (
            <Button variant="secondary" size="sm" onClick={startNew} disabled={loading}>
              New conversation
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">
          <History
            items={history}
            activeId={conversationId}
            onOpen={openConversation}
            onNew={startNew}
            onDelete={deleteConversation}
            loading={historyLoading}
          />
        </div>

        <div className="order-1 mx-auto w-full max-w-[46rem] lg:order-2">
          {restoring && (
            <div className="rounded-lg border border-rule bg-surface px-4 py-3 text-[13px] text-ink-2">Loading the conversation…</div>
          )}

          {messages.length === 0 && !loading && !restoring && (
            <div className="rounded-lg border border-dashed border-rule-strong bg-surface px-5 py-8">
              <p className="text-sm text-ink-2">
                Try one of these, {user?.name?.split(' ')[0]}:
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {prompts.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => ask(p)}
                      className="w-full rounded-md border border-rule bg-paper px-3.5 py-3 text-left text-[13px] leading-snug text-ink hover:border-rule-strong hover:bg-paper-deep transition-colors"
                    >
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ol className="space-y-4" aria-live="polite">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <li key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-lg bg-board px-4 py-2.5 text-[15px] leading-relaxed text-paper whitespace-pre-wrap">
                    {m.content}
                  </p>
                </li>
              ) : (
                <li key={i} className="animate-lift-in">
                  <article className={`rounded-lg border bg-surface px-4 py-3.5 ${m.status === 'error' ? 'border-brick-line' : 'border-rule'}`}>
                    <Prose text={m.content} />
                    {m.trace && <Trace {...m.trace} />}
                  </article>
                </li>
              )
            )}

            {loading && (
              <li>
                <div className="rounded-lg border border-rule bg-surface px-4 py-3.5">
                  {live.text ? (
                    <div>
                      <Prose text={live.text} />
                      <span aria-hidden="true" className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-board animate-rule-pulse" />
                    </div>
                  ) : (
                    <>
                      <div className="h-[3px] w-28 overflow-hidden rounded-full bg-rule">
                        <div className="h-full w-1/3 rounded-full bg-board animate-rule-pulse" />
                      </div>
                      <p className="mt-2.5 text-[13px] text-ink-2" aria-live="polite">
                        {live.status || 'Looking through the club\'s records'}
                        {live.steps.length > 0 && (
                          <span className="text-ink-3"> · {live.steps.length} {live.steps.length === 1 ? 'lookup' : 'lookups'} so far</span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </li>
            )}
          </ol>
          {/* Tall enough that scrolling it into view leaves the last message clear of the sticky form. */}
          <div ref={endRef} className="h-28 sm:h-24" aria-hidden="true" />

          {error && (
            <div role="alert" className="mt-4 rounded-md border border-brick-line bg-brick-wash px-3.5 py-3">
              <p className="text-[13px] text-brick">{error}</p>
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className="sticky bottom-0 -mx-4 -mt-24 border-t border-rule bg-paper px-4 pb-4 pt-3 sm:mx-0 sm:-mt-20 sm:border-0 sm:pb-4 sm:pt-3"
          >
            <div className="flex items-end gap-2 rounded-lg border border-rule-strong bg-surface p-1.5 focus-within:border-board">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={2000}
                placeholder={conversationId ? 'Ask a follow-up' : 'Ask about a student, a session, or a topic'}
                aria-label="Your question"
                disabled={loading || restoring}
                className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none disabled:opacity-60"
              />
              <Button
                type="submit"
                size="md"
                loading={loading}
                disabled={restoring || !input.trim()}
              >
                {loading ? 'Thinking' : 'Ask'}
              </Button>
            </div>
            <p className="mt-2 text-[12px] text-ink-3">
              Enter to send, Shift+Enter for a new line. It reads the club's data; it cannot change it.
            </p>
          </form>
        </div>
      </div>
    </Layout>
  );
}
