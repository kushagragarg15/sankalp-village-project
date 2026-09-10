import { useState } from 'react';
import api from '../utils/api';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Input, { Select, Textarea } from '../components/Input';
import { useToast } from '../context/ToastContext';

const CLASSES = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8'];
const SUBJECTS = ['Math', 'Science', 'English', 'Hindi', 'Social Studies', 'Other'];

export default function AITeachingNotes() {
  const [form, setForm] = useState({
    topic: '',
    grade: 'Class 5',
    subject: 'Math',
    extraInstructions: '',
  });
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSources, setShowSources] = useState(false);
  const toast = useToast();

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPlan(null);
    setShowSources(false);

    try {
      const response = await api.post('/ai/generate-notes', form);
      setPlan(response.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'The plan could not be drafted. Try again in a moment.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!plan?.notes) return;
    try {
      await navigator.clipboard.writeText(plan.notes);
      toast.done('Plan copied.');
    } catch {
      toast.blocked('The plan could not be copied. Select the text and copy it manually.');
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Lesson planner"
        lede="Draft an outline for a topic before you head out. It is built from the club's own teaching material, and every plan shows what it drew on."
      />

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <form onSubmit={handleGenerate} className="space-y-4 lg:sticky lg:top-10 lg:self-start">
          <Input
            label="Topic"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="Fractions"
            required
          />

          <Select
            label="Class"
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <Select
            label="Subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <Textarea
            label="Anything to keep in mind"
            value={form.extraInstructions}
            onChange={(e) => setForm({ ...form, extraInstructions: e.target.value })}
            placeholder="Mixed ability group, no printed sheets available"
            hint="Optional."
            rows={3}
          />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Drafting' : 'Draft a plan'}
          </Button>

          {error && (
            <div role="alert" className="rounded-md border border-brick-line bg-brick-wash px-3.5 py-3">
              <p className="text-[13px] text-brick">{error}</p>
            </div>
          )}
        </form>

        <div>
          {!plan && !loading && (
            <div className="rounded-lg border border-dashed border-rule-strong bg-surface px-6 py-16 text-center">
              <p className="text-sm text-ink-2 max-w-[38ch] mx-auto">
                Name a topic on the left and the planner will draft an outline you
                can take into the classroom.
              </p>
            </div>
          )}

          {loading && (
            <div className="rounded-lg border border-rule bg-surface px-6 py-16 text-center">
              <div className="mx-auto h-[3px] w-32 overflow-hidden rounded-full bg-rule">
                <div className="h-full w-1/3 rounded-full bg-board animate-rule-pulse" />
              </div>
              <p className="mt-3 text-[13px] text-ink-2">
                Reading the club's material for {form.topic || 'this topic'}
              </p>
            </div>
          )}

          {plan && (
            <article className="rounded-lg border border-rule bg-surface">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
                <div>
                  <h2 className="type-title text-[17px] text-ink">{plan.topic}</h2>
                  <p className="mt-0.5 text-[13px] text-ink-2">
                    {plan.grade}, {plan.subject}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleCopy}>
                  Copy plan
                </Button>
              </header>

              {plan.sources?.length > 0 && (
                <div className="border-b border-rule px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setShowSources(!showSources)}
                    aria-expanded={showSources}
                    className="flex items-center gap-2 text-[13px] text-ink-2 hover:text-ink"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={`transition-transform ${showSources ? 'rotate-90' : ''}`}
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                    Built from {plan.sources.length} teaching{' '}
                    {plan.sources.length === 1 ? 'resource' : 'resources'}
                  </button>

                  {showSources && (
                    <ul className="mt-3 divide-y divide-rule border-y border-rule">
                      {plan.sources.map((source, index) => (
                        <li key={index} className="flex gap-3 py-2.5">
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium text-ink">
                              {source.label}
                            </span>
                            <span className="mt-0.5 block text-[13px] text-ink-2 line-clamp-2">
                              {source.snippet}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[12px] text-ink-3 tabular-nums">
                            {(parseFloat(source.similarity) * 100).toFixed(0)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="px-5 py-5">
                <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink max-w-[70ch]">
                  {plan.notes}
                </div>
              </div>

              <footer className="border-t border-rule px-5 py-3">
                <p className="text-[13px] text-ink-3">
                  Drafted {new Date(plan.generatedAt).toLocaleString('en-IN')}. Read it
                  through before the session — it is a starting point, not a script.
                </p>
              </footer>
            </article>
          )}
        </div>
      </div>
    </Layout>
  );
}
