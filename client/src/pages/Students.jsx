import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import Input, { Select } from '../components/Input';
import Table, {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/Table';
import { useToast } from '../context/ToastContext';

const CLASSES = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8'];

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', grade: 'Class 5', parentPhone: '' });
  const navigate = useNavigate();
  const toast = useToast();

  const fetchStudents = async () => {
    try {
      const response = await api.get('/students');
      setStudents(response.data.data || []);
    } catch {
      toast.blocked('The student roster could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/students', form);
      setShowModal(false);
      setForm({ name: '', grade: 'Class 5', parentPhone: '' });
      await fetchStudents();
      toast.done(`${form.name} added to the roster.`);
    } catch (err) {
      toast.blocked(err.response?.data?.message || 'That student could not be added.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        String(s.grade).toLowerCase().includes(term)
    );
  }, [students, search]);

  if (loading) {
    return (
      <Layout>
        <LoadingState label="Loading students" />
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Students"
        lede={
          students.length > 0
            ? `${students.length} ${students.length === 1 ? 'child' : 'children'} enrolled. Open a name to see what they have been taught.`
            : 'The children enrolled with the club.'
        }
        actions={<Button onClick={() => setShowModal(true)}>Add a student</Button>}
      />

      {students.length === 0 ? (
        <EmptyState
          title="No students on the roster"
          description="Add the children the club teaches so volunteers can record lessons against them."
          action={<Button onClick={() => setShowModal(true)}>Add a student</Button>}
        />
      ) : (
        <>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or class"
            aria-label="Search students"
            className="mb-4 w-full sm:max-w-xs h-11 rounded-md border border-rule-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-board focus:ring-1 focus:ring-board"
          />

          {filtered.length === 0 ? (
            <p className="py-8 text-sm text-ink-2">
              No student matches “{search}”.
            </p>
          ) : (
            <>
              {/* Phone: ruled rows. */}
              <ul className="sm:hidden divide-y divide-rule border-y border-rule">
                {filtered.map((student) => (
                  <li key={student._id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/students/${student._id}`)}
                      className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink truncate">
                          {student.name}
                        </span>
                        <span className="block text-[13px] text-ink-2">
                          {student.grade}
                          {student.parentPhone ? ` · ${student.parentPhone}` : ''}
                        </span>
                      </span>
                      <svg className="shrink-0 text-ink-3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="hidden sm:block rounded-lg border border-rule bg-surface overflow-hidden">
                <Table minWidth={640}>
                  <TableHead>
                    <tr>
                      <TableHeader>Name</TableHeader>
                      <TableHeader>Class</TableHeader>
                      <TableHeader>Parent phone</TableHeader>
                      <TableHeader>Enrolled</TableHeader>
                      <TableHeader className="text-right">Progress</TableHeader>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {filtered.map((student) => (
                      <TableRow key={student._id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>
                          <Badge variant="quiet">{student.grade}</Badge>
                        </TableCell>
                        <TableCell>
                          {student.parentPhone || (
                            <span className="text-ink-3">Not on file</span>
                          )}
                        </TableCell>
                        <TableCell className="text-ink-2">
                          {new Date(student.enrollmentDate).toLocaleDateString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/students/${student._id}`)}
                            className="text-[13px] text-ink underline underline-offset-4 hover:opacity-70"
                          >
                            Open
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add a student"
        description="They can be taught and recorded from the next session onward."
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name"
            required
          />

          <Select
            label="Class"
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
            required
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <Input
            label="Parent phone"
            type="tel"
            value={form.parentPhone}
            onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
            placeholder="+91 98765 43210"
            hint="Optional. Used to reach the family about sessions."
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding' : 'Add student'}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
