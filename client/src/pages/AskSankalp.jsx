import { useEffect, useRef, useState } from 'react';
import { aiAPI } from '../utils/api';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Prose from '../components/Prose';
import { useAuth } from '../context/AuthContext';

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

export default function AskSankalp() {
  const { isAdmin, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // What is happening right now, while an answer streams in.
  const [live, setLive] = useState({ text: '', status: '', steps: [] });
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const prompts = isAdmin ? ADMIN_PROMPTS : VOLUNTEER_PROMPTS;

  // Smooth scrolling is for a new message landing. While an answer streams,
  // this fires on every token, and dozens of overlapping smooth scrolls make
  // the page crawl — so jump instantly until the stream is done.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth', block: 'end' });
  }, [messages, loading, live.text, live.status]);

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
      // Only the clean user/assistant transcript goes up; the server owns the
      // tool calls and re-runs them fresh for every question.
      const transcript = next.map(({ role, content }) => ({ role, content }));

      // Stream when we can — tool steps and the answer appear as they happen.
      // If the stream endpoint is unreachable (an old server, a proxy that
      // strips streams), fall back to the plain request; same answer, later.
      let result;
      try {
        result = await aiAPI.askStream(transcript, (event) => {
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
        const { data } = await aiAPI.ask(transcript);
        result = data.data;
      }
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: result.answer,
          trace: {
            steps: result.steps || [],
            iterations: result.iterations,
            durationMs: result.durationMs,
            llmMs: result.llmMs,
            usage: result.usage,
          },
        },
      ]);
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
        lede="Ask about students, sessions, your own record or how to teach a topic. It answers from the club's records, and shows what it looked up."
        actions={
          messages.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setMessages([])}>
              Start over
            </Button>
          )
        }
      />

      <div className="mx-auto max-w-[46rem]">
        {messages.length === 0 && !loading && (
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
                <article className="rounded-lg border border-rule bg-surface px-4 py-3.5">
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
              placeholder="Ask about a student, a session, or a topic"
              aria-label="Your question"
              disabled={loading}
              className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none disabled:opacity-60"
            />
            <Button type="submit" size="md" disabled={loading || !input.trim()}>
              {loading ? 'Thinking' : 'Ask'}
            </Button>
          </div>
          <p className="mt-2 text-[12px] text-ink-3">
            Enter to send, Shift+Enter for a new line. It reads the club's data; it cannot change it.
          </p>
        </form>
      </div>
    </Layout>
  );
}
