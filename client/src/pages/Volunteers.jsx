import { useEffect, useState } from 'react';
import { volunteerAttendanceAPI } from '../utils/api';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import Table, {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/Table';
import { useToast } from '../context/ToastContext';

export default function Volunteers() {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const response = await volunteerAttendanceAPI.getAll();
        setVolunteers(response.data.data || []);
      } catch {
        toast.blocked('The volunteer list could not be loaded.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Layout>
        <LoadingState label="Loading volunteers" />
      </Layout>
    );
  }

  const top = volunteers[0];

  return (
    <Layout>
      <PageHeader
        title="Volunteers"
        lede="Ranked by the number of sessions each person has actually taught, not by sign-ups."
      />

      {volunteers.length === 0 ? (
        <EmptyState
          title="No volunteers yet"
          description="Once volunteers record attendance at a session, they appear here with their session count."
        />
      ) : (
        <>
          {top && (
            <div className="mb-6 rounded-lg bg-board px-5 py-5 text-paper sm:px-6">
              <p className="text-[13px] text-board-400">Most sessions taught</p>
              <p className="type-display mt-1 text-[26px] sm:text-[30px] text-paper">
                {top.name}
              </p>
              <p className="mt-1 text-sm text-gold-bright tabular-nums">
                {top.sessionsAttended}{' '}
                {top.sessionsAttended === 1 ? 'session' : 'sessions'}
              </p>
            </div>
          )}

          {/* Phone: ruled rows. */}
          <ul className="sm:hidden divide-y divide-rule border-y border-rule">
            {volunteers.map((volunteer) => (
              <li key={volunteer._id} className="flex items-center gap-3 py-3.5">
                <span className="w-7 shrink-0 font-mono text-[13px] text-ink-3 tabular-nums">
                  {volunteer.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink truncate">
                    {volunteer.name}
                  </span>
                  <span className="block text-[13px] text-ink-2 truncate">
                    {volunteer.email}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-ink tabular-nums">
                  {volunteer.sessionsAttended}
                </span>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block rounded-lg border border-rule bg-surface overflow-hidden">
            <Table minWidth={620}>
              <TableHead>
                <tr>
                  <TableHeader className="w-16">Rank</TableHeader>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Email</TableHeader>
                  <TableHeader>Phone</TableHeader>
                  <TableHeader className="text-right">Sessions taught</TableHeader>
                </tr>
              </TableHead>
              <TableBody>
                {volunteers.map((volunteer) => (
                  <TableRow key={volunteer._id}>
                    <TableCell className="font-mono text-ink-2 tabular-nums">
                      {volunteer.rank}
                    </TableCell>
                    <TableCell className="font-medium">{volunteer.name}</TableCell>
                    <TableCell className="text-ink-2">{volunteer.email}</TableCell>
                    <TableCell className="text-ink-2">
                      {volunteer.phone || <span className="text-ink-3">Not on file</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {volunteer.sessionsAttended}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Layout>
  );
}
