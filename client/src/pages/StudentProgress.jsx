import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import StatStrip from '../components/StatStrip';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Input, { Select } from '../components/Input';
import { useToast } from '../context/ToastContext';

const SUBJECTS = ['Math', 'Science', 'English', 'Hindi', 'Social Studies'];

export default function StudentProgress() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quiz, setQuiz] = useState({
    subject: 'Math',
    topic: '',
    score: '',
    maxScore: '10',
  });

  const fetchProgress = async () => {
    try {
      const response = await api.get(`/students/${id}/progress`);
      setProgress(response.data.data);
    } catch {
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [id]);

  const handleQuizSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/students/${id}/quiz-score`, quiz);
      setShowModal(false);
      setQuiz({ subject: 'Math', topic: '', score: '', maxScore: '10' });
      await fetchProgress();
      toast.done('Quiz score saved.');
    } catch (err) {
      toast.blocked(err.response?.data?.message || 'That score could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <LoadingState label="Loading progress" />
      </Layout>
    );
  }

  if (!progress) {
    return (
      <Layout>
        <EmptyState
          title="Student not found"
          description="They may have been removed from the roster."
          action={<Button onClick={() => navigate('/students')}>Back to students</Button>}
        />
      </Layout>
    );
  }

  const subjects = Object.entries(progress.topicsCovered || {});
  const quizzes = progress.quizScores || [];

  return (
    <Layout>
      <button
        type="button"
        onClick={() => navigate('/students')}
        className="mb-4 text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink"
      >
        Back to students
      </button>

      <PageHeader
        title={progress.student.name}
        lede={`${progress.student.grade} · enrolled with the club`}
        actions={<Button onClick={() => setShowModal(true)}>Record a quiz score</Button>}
      />

      <StatStrip
        className="mb-10 lg:grid-cols-3"
        items={[
          {
            label: 'Sessions attended',
            value: progress.attendance?.eventsAttended || 0,
            note: `${progress.attendance?.percentage || 0}% of sessions run`,
          },
          { label: 'Subjects covered', value: subjects.length },
          { label: 'Quizzes recorded', value: quizzes.length },
        ]}
      />

      <section className="mb-10">
        <h2 className="type-title mb-4 text-[15px] text-ink">What has been taught</h2>

        {subjects.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="Topics appear here as volunteers log what they covered in each session."
          />
        ) : (
          <div className="space-y-6">
            {subjects.map(([subject, topics]) => (
              <div key={subject}>
                <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
                  <h3 className="text-sm font-medium text-ink">{subject}</h3>
                  <span className="text-[13px] text-ink-2 tabular-nums">
                    {topics.length} {topics.length === 1 ? 'lesson' : 'lessons'}
                  </span>
                </div>
                <ul className="divide-y divide-rule">
                  {topics.map((topic, index) => (
                    <li
                      key={index}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5"
                    >
                      <span className="text-sm text-ink">
                        {topic.topic}
                        {topic.volunteer && (
                          <span className="text-ink-3"> · taught by {topic.volunteer}</span>
                        )}
                      </span>
                      <span className="text-[13px] text-ink-2">
                        {new Date(topic.date).toLocaleDateString('en-IN')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="type-title mb-4 text-[15px] text-ink">Quiz scores</h2>

        {quizzes.length === 0 ? (
          <EmptyState
            title="No quiz scores yet"
            description="Record one after a session to track how the topic landed."
            action={<Button onClick={() => setShowModal(true)}>Record a quiz score</Button>}
          />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {quizzes.map((entry, index) => {
              const ratio = entry.score / entry.maxScore;
              return (
                <li
                  key={index}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{entry.topic}</p>
                    <p className="text-[13px] text-ink-2">
                      {entry.subject}
                      <span className="text-ink-3">
                        {' · '}
                        {new Date(entry.date).toLocaleDateString('en-IN')}
                      </span>
                    </p>
                  </div>
                  <Badge variant={ratio >= 0.7 ? 'recorded' : 'default'}>
                    {entry.score} of {entry.maxScore}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Record a quiz score"
        description={`For ${progress.student.name}`}
        size="sm"
      >
        <form onSubmit={handleQuizSubmit} className="space-y-4">
          <Select
            label="Subject"
            value={quiz.subject}
            onChange={(e) => setQuiz({ ...quiz, subject: e.target.value })}
            required
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <Input
            label="Topic"
            value={quiz.topic}
            onChange={(e) => setQuiz({ ...quiz, topic: e.target.value })}
            placeholder="Fractions"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Score"
              type="number"
              inputMode="numeric"
              value={quiz.score}
              onChange={(e) => setQuiz({ ...quiz, score: e.target.value })}
              min="0"
              required
            />
            <Input
              label="Out of"
              type="number"
              inputMode="numeric"
              value={quiz.maxScore}
              onChange={(e) => setQuiz({ ...quiz, maxScore: e.target.value })}
              min="1"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? 'Saving' : 'Save score'}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
