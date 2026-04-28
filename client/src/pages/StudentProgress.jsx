import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Layout from '../components/Layout';
import Card, { CardBody, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Input, { Select } from '../components/Input';

export default function StudentProgress() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizData, setQuizData] = useState({
    subject: 'Math',
    topic: '',
    score: '',
    maxScore: '10'
  });

  useEffect(() => {
    fetchProgress();
  }, [id]);

  const fetchProgress = async () => {
    try {
      const response = await api.get(`/students/${id}/progress`);
      setProgress(response.data.data);
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuizSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/students/${id}/quiz-score`, quizData);
      setShowQuizModal(false);
      setQuizData({ subject: 'Math', topic: '', score: '', maxScore: '10' });
      fetchProgress();
    } catch (error) {
      console.error('Error adding quiz score:', error);
      alert('Failed to add quiz score');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading student progress...</p>
        </div>
      </Layout>
    );
  }

  if (!progress) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-zinc-500">Student not found</p>
          <Button onClick={() => navigate('/students')} className="mt-4">
            Back to Students
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/students')}
              className="mb-2"
            >
              ← Back to Students
            </Button>
            <h1 className="text-2xl font-semibold text-zinc-900">
              {progress.student.name}
            </h1>
            <p className="text-zinc-600">
              {progress.student.grade}
            </p>
          </div>
          <Button onClick={() => setShowQuizModal(true)}>
            Add Quiz Score
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardBody>
              <p className="text-sm text-zinc-500 mb-1">Sessions Attended</p>
              <p className="text-3xl font-semibold text-zinc-900">
                {progress.attendance.eventsAttended || 0}
              </p>
              <p className="text-sm text-zinc-600 mt-1">
                {progress.attendance.percentage || 0}% attendance rate
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-sm text-zinc-500 mb-1">Subjects Covered</p>
              <p className="text-3xl font-semibold text-zinc-900">
                {Object.keys(progress.topicsCovered).length}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-sm text-zinc-500 mb-1">Quiz Scores</p>
              <p className="text-3xl font-semibold text-zinc-900">
                {progress.quizScores.length}
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Topics Covered */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Topics Covered by Subject</CardTitle>
          </CardHeader>
          <CardBody>
            {Object.keys(progress.topicsCovered).length === 0 ? (
              <p className="text-zinc-500 text-center py-4">
                No topics covered yet
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(progress.topicsCovered).map(([subject, topics]) => (
                  <div key={subject}>
                    <h3 className="font-semibold text-zinc-900 mb-3">{subject}</h3>
                    <div className="space-y-2">
                      {topics.map((topic, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-zinc-50 rounded-md"
                        >
                          <span className="text-sm text-zinc-900">{topic.topic}</span>
                          <span className="text-xs text-zinc-500">
                            {new Date(topic.date).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Quiz Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Quiz Scores</CardTitle>
          </CardHeader>
          <CardBody>
            {progress.quizScores.length === 0 ? (
              <p className="text-zinc-500 text-center py-4">
                No quiz scores recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {progress.quizScores.map((quiz, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border border-zinc-200 rounded-md"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">{quiz.topic}</p>
                      <p className="text-sm text-zinc-600">{quiz.subject}</p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          (quiz.score / quiz.maxScore) >= 0.7 ? 'success' : 'warning'
                        }
                      >
                        {quiz.score}/{quiz.maxScore}
                      </Badge>
                      <p className="text-xs text-zinc-500 mt-1">
                        {new Date(quiz.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Add Quiz Score Modal */}
        <Modal
          isOpen={showQuizModal}
          onClose={() => setShowQuizModal(false)}
          title="Add Quiz Score"
        >
          <form onSubmit={handleQuizSubmit} className="space-y-4">
            <Select
              label="Subject"
              value={quizData.subject}
              onChange={(e) => setQuizData({ ...quizData, subject: e.target.value })}
              required
            >
              <option value="Math">Math</option>
              <option value="Science">Science</option>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Social Studies">Social Studies</option>
            </Select>

            <Input
              label="Topic"
              value={quizData.topic}
              onChange={(e) => setQuizData({ ...quizData, topic: e.target.value })}
              placeholder="e.g., Fractions"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Score"
                type="number"
                value={quizData.score}
                onChange={(e) => setQuizData({ ...quizData, score: e.target.value })}
                min="0"
                required
              />

              <Input
                label="Max Score"
                type="number"
                value={quizData.maxScore}
                onChange={(e) => setQuizData({ ...quizData, maxScore: e.target.value })}
                min="1"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowQuizModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Score</Button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
