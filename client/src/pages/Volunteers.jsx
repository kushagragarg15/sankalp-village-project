import { useEffect, useState } from 'react';
import { volunteerAttendanceAPI, userAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Input, { Select } from '../components/Input';
import Table, {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/Table';
import { useToast } from '../context/ToastContext';

const emptyForm = { name: '', email: '', password: '', role: 'volunteer', phone: '' };

export default function Volunteers() {
  const [volunteers, setVolunteers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [pendingRole, setPendingRole] = useState(null);
  const { user } = useAuth();
  const toast = useToast();
  const canManageRoles = !!user?.isSuperAdmin;

  const load = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        volunteerAttendanceAPI.getAll(),
        userAPI.getAll(),
      ]);
      setVolunteers(statsRes.data.data || []);
      setMembers(usersRes.data.data || []);
    } catch {
      toast.blocked('The volunteer list could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');

    if (form.password.length < 6) {
      setFormError('The password needs at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      await userAPI.create(form);
      setShowAdd(false);
      setForm(emptyForm);
      await load();
      toast.done(`${form.name} can now sign in.`);
    } catch (err) {
      setFormError(err.response?.data?.message || 'That account could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async () => {
    if (!pendingRole) return;
    const { member, nextRole } = pendingRole;
    setSaving(true);
    try {
      await userAPI.update(member._id, { role: nextRole });
      setPendingRole(null);
      await load();
      toast.done(
        nextRole === 'admin'
          ? `${member.name} is now a coordinator.`
          : `${member.name} is now a volunteer.`
      );
    } catch (err) {
      toast.blocked(err.response?.data?.message || 'That role could not be changed.');
      setPendingRole(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <LoadingState label="Loading volunteers" />
      </Layout>
    );
  }

  const top = volunteers[0];
  const coordinators = members.filter((m) => m.role === 'admin');

  return (
    <Layout>
      <PageHeader
        title="Volunteers"
        lede="Ranked by the number of sessions each person has actually taught, not by sign-ups."
        actions={<Button onClick={() => setShowAdd(true)}>Add a member</Button>}
      />

      {volunteers.length === 0 ? (
        <EmptyState
          title="No volunteers yet"
          description="Add a member so they can sign in and register for sessions."
          action={<Button onClick={() => setShowAdd(true)}>Add a member</Button>}
        />
      ) : (
        <>
          {top && top.sessionsAttended > 0 && (
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

      <section className="mt-10">
        <h2 className="type-title mb-1.5 text-[15px] text-ink">Coordinators</h2>
        <p className="mb-4 text-[13px] text-ink-2 max-w-[62ch]">
          Coordinators open sessions, read out the attendance code, and see the
          full attendance report. Signing in never changes anyone&rsquo;s role
          {canManageRoles ? ' — it is granted here.' : '; only a super admin can change it.'}
        </p>

        <ul className="divide-y divide-rule border-y border-rule">
          {members.map((member) => {
            const isSelf = String(member._id) === String(user?._id || user?.id);
            const isAdmin = member.role === 'admin';

            return (
              <li
                key={member._id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {member.name}
                    {isSelf && <span className="text-ink-3"> (you)</span>}
                  </p>
                  <p className="text-[13px] text-ink-2 truncate">{member.email}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {member.isSuperAdmin && <Badge variant="default">Super admin</Badge>}
                  <Badge variant={isAdmin ? 'recorded' : 'quiet'}>
                    {isAdmin ? 'Coordinator' : 'Volunteer'}
                  </Badge>

                  {!canManageRoles || isSelf || member.isSuperAdmin ? (
                    <span className="text-[13px] text-ink-3">—</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setPendingRole({
                          member,
                          nextRole: isAdmin ? 'volunteer' : 'admin',
                        })
                      }
                      className="text-[13px] text-ink underline underline-offset-4 hover:opacity-70"
                    >
                      {isAdmin ? 'Make volunteer' : 'Make coordinator'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {coordinators.length === 1 && (
          <p className="mt-3 text-[13px] text-ink-2">
            {coordinators[0].name} is the only coordinator. Add another before
            removing this one, or nobody can open sessions.
          </p>
        )}
      </section>

      <Modal
        isOpen={showAdd}
        onClose={() => {
          setShowAdd(false);
          setFormError('');
        }}
        title="Add a member"
        description="They sign in with this email and password, or with Google using the same address."
        size="sm"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name"
            required
          />

          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="name@lnmiit.ac.in"
            required
          />

          <Input
            label="Temporary password"
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 6 characters"
            hint="Share this with them directly. They can sign in with Google instead if they prefer."
            required
          />

          {canManageRoles ? (
            <Select
              label="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="volunteer">Volunteer — teaches and records attendance</option>
              <option value="admin">Coordinator — also opens sessions and reads reports</option>
            </Select>
          ) : (
            <p className="text-[13px] text-ink-2">
              Added as a volunteer. Only a super admin can add someone directly as a coordinator.
            </p>
          )}

          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 98765 43210"
            hint="Optional."
          />

          {formError && (
            <div role="alert" className="rounded-md border border-brick-line bg-brick-wash px-3.5 py-3">
              <p className="text-[13px] text-brick">{formError}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? 'Adding' : 'Add member'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!pendingRole}
        onClose={() => setPendingRole(null)}
        title={
          pendingRole?.nextRole === 'admin'
            ? 'Make this person a coordinator?'
            : 'Remove coordinator access?'
        }
        description={pendingRole?.member?.name}
        size="sm"
      >
        <p className="text-sm text-ink-2">
          {pendingRole?.nextRole === 'admin'
            ? 'They will be able to open sessions, see the attendance code, read the full report, and change other people’s roles.'
            : 'They will keep teaching and recording attendance, but lose access to sessions, the code, and the attendance report.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPendingRole(null)}>
            Cancel
          </Button>
          <Button onClick={handleRoleChange} loading={saving}>
            {saving ? 'Saving' : 'Confirm'}
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
