import { useState } from 'react';
import DataState from '../components/DataState';
import Badge from '../components/Badge';
import { useCreateUserMutation, useDeactivateUserMutation, useUsersQuery } from '../services/api';
import { apiError, roleLabel } from '../utils/format';

const roles = ['ADMIN', 'DOCTOR', 'DIETICIAN', 'KITCHEN_STAFF', 'DELIVERY_STAFF', 'PATIENT'];

export default function UsersPage() {
  const [role, setRole] = useState('');
  const { data, isLoading, error } = useUsersQuery({ role: role || undefined });
  const [createUser, createState] = useCreateUserMutation();
  const [deactivate] = useDeactivateUserMutation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: 'Admin@1234', role: 'DOCTOR' });

  async function submit(e) {
    e.preventDefault();
    await createUser(form).unwrap();
    setForm({ name: '', email: '', phone: '', password: 'Admin@1234', role: 'DOCTOR' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">User and RBAC Management</h2>
        <p className="text-sm text-slate-500">Admin-only module to create staff accounts and deactivate access.</p>
      </div>
      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="card space-y-4 p-5">
          <h3 className="text-lg font-black text-slate-900">Create user</h3>
          <label><span className="label">Name</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label><span className="label">Email</span><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label><span className="label">Phone</span><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label><span className="label">Role</span><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
          <label><span className="label">Temporary password</span><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          {createState.error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(createState.error)}</p>}
          <button className="btn-primary w-full" disabled={createState.isLoading}>Create account</button>
        </form>
        <DataState isLoading={isLoading} error={error}>
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-900">Users</h3>
              <select className="input max-w-xs" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option>{roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.data?.items || []).map((user) => (
                    <tr key={user.id} className="text-slate-700"><td className="py-3 font-semibold">{user.name}</td><td>{user.email}</td><td>{roleLabel(user.role)}</td><td><Badge value={user.isActive ? 'APPROVED' : 'CANCELLED'} /></td><td className="text-right"><button className="btn-secondary" disabled={!user.isActive} onClick={() => deactivate(user.id)}>Deactivate</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DataState>
      </section>
    </div>
  );
}
