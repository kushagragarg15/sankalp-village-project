import { useState } from 'react';
import api from '../utils/api';
import Layout from '../components/Layout';
import Input, { Select } from '../components/Input';

export default function AITeachingNotes() {
  const [formData, setFormData] = useState({
    topic: '',
    grade: 'Class 5',
    subject: 'Math',
    extraInstructions: ''
  });
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSources, setShowSources] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotes(null);
    setShowSources(false);

    try {
      const response = await api.post('/ai/generate-notes', formData);
      setNotes(response.data.data);
    } catch (error) {
      console.error('Error generating notes:', error);
      setError(
        error.response?.data?.message ||
        'Failed to generate notes. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (notes?.notes) {
      navigator.clipboard.writeText(notes.notes);
      alert('Notes copied to clipboard!');
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl">
        <h1 className="text-[22px] font-semibold text-[#111111] mb-1">
          Teaching Notes Generator
        </h1>
        <p className="text-[13px] text-[#6b6b6b] mb-6">
          Generate a structured lesson outline for your session
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Form */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-[#e4e4e4] rounded-lg p-6">
              <form onSubmit={handleGenerate} className="space-y-4">
                <Input
                  label="Topic"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="e.g., Fractions"
                  required
                />

                <Select
                  label="Grade/Class"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                >
                  <option value="Class 1">Class 1</option>
                  <option value="Class 2">Class 2</option>
                  <option value="Class 3">Class 3</option>
                  <option value="Class 4">Class 4</option>
                  <option value="Class 5">Class 5</option>
                  <option value="Class 6">Class 6</option>
                  <option value="Class 7">Class 7</option>
                  <option value="Class 8">Class 8</option>
                </Select>

                <Select
                  label="Subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                >
                  <option value="Math">Math</option>
                  <option value="Science">Science</option>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Social Studies">Social Studies</option>
                  <option value="Other">Other</option>
                </Select>

                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Additional Instructions (Optional)
                  </label>
                  <textarea
                    value={formData.extraInstructions}
                    onChange={(e) => setFormData({ ...formData, extraInstructions: e.target.value })}
                    placeholder="e.g., Focus on visual learning, include a song"
                    rows={3}
                    className="w-full px-3 py-2 text-[13px] border border-[#e4e4e4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#111111] focus:border-transparent resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 bg-[#111111] text-white text-[13px] font-medium rounded-md hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Generating...' : 'Generate Notes'}
                </button>
              </form>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Generated Notes */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-[#e4e4e4] rounded-lg p-6 min-h-[400px]">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-[#111111]">Generated Teaching Notes</h2>
                {notes && (
                  <button
                    onClick={handleCopy}
                    className="h-8 px-4 bg-white border border-[#e4e4e4] text-[#111111] text-[13px] font-medium rounded-md hover:bg-[#fafafa] transition-colors"
                  >
                    Copy Notes
                  </button>
                )}
              </div>

              {!notes && !loading && (
                <div className="text-center py-12">
                  <p className="text-[#9a9a9a] text-[13px]">
                    Enter a topic and subject above, then click Generate Notes.
                  </p>
                </div>
              )}

              {loading && (
                <div className="text-center py-12">
                  <div className="animate-pulse">
                    <p className="text-[#6b6b6b] text-sm">Generating your teaching notes...</p>
                  </div>
                </div>
              )}

              {notes && (
                <div>
                  <div className="mb-4 pb-4 border-b border-[#f0f0f0]">
                    <h3 className="font-semibold text-[#111111] text-sm">{notes.topic}</h3>
                    <p className="text-[13px] text-[#6b6b6b]">
                      {notes.grade} • {notes.subject}
                    </p>
                  </div>

                  {/* RAG Sources Section */}
                  {notes.sources && notes.sources.length > 0 && (
                    <div className="mb-4 pb-4 border-b border-[#f0f0f0]">
                      <button
                        onClick={() => setShowSources(!showSources)}
                        className="flex items-center gap-2 text-[13px] font-medium text-[#111111] hover:text-[#2a2a2a] transition-colors"
                      >
                        <span>📚 Grounded in {notes.sources.length} teaching resource{notes.sources.length > 1 ? 's' : ''}</span>
                        <span className="text-[#9a9a9a]">{showSources ? '▼' : '▶'}</span>
                      </button>
                      
                      {showSources && (
                        <div className="mt-3 space-y-2">
                          {notes.sources.map((source, idx) => (
                            <div key={idx} className="p-3 bg-[#fafafa] rounded-md border border-[#f0f0f0]">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-[12px] font-medium text-[#111111]">
                                    {source.label}
                                  </p>
                                  <p className="text-[11px] text-[#6b6b6b] mt-1 line-clamp-2">
                                    {source.snippet}
                                  </p>
                                </div>
                                <span className="text-[10px] text-[#9a9a9a] font-mono shrink-0">
                                  {(parseFloat(source.similarity) * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          ))}
                          <p className="text-[11px] text-[#9a9a9a] italic mt-2">
                            These resources were retrieved and used to generate your lesson plan.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="whitespace-pre-wrap text-[#111111] text-sm leading-relaxed">
                      {notes.notes}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#f0f0f0]">
                    <p className="text-xs text-[#9a9a9a]">
                      Generated on {new Date(notes.generatedAt).toLocaleString()}
                      {notes.sources && notes.sources.length > 0 && 
                        ` • RAG-powered with ${notes.sources.length} source${notes.sources.length > 1 ? 's' : ''}`
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 text-center">
          <p className="text-[13px] text-[#9a9a9a]">
            Enter topic  ·  Select grade and subject  ·  Copy the generated outline
          </p>
        </div>
      </div>
    </Layout>
  );
}
