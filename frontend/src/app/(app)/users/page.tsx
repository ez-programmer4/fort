'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface RoleOption {
  id: number;
  name: string;
}

interface UserRow {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  role: RoleOption;
}

interface FormState {
  id: number | null; // null = creating
  fullName: string;
  email: string;
  password: string;
  roleId: string;
}

const emptyForm: FormState = { id: null, fullName: '', email: '', password: '', roleId: '' };

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [u, r] = await Promise.all([
      api<{ users: UserRow[] }>('/api/users'),
      api<{ roles: RoleOption[] }>('/api/roles'),
    ]);
    setUsers(u.users);
    setRoles(r.roles);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    setSaving(true);
    try {
      if (form.id === null) {
        await api('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            fullName: form.fullName,
            email: form.email,
            password: form.password,
            roleId: Number(form.roleId),
          }),
        });
      } else {
        await api(`/api/users/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fullName: form.fullName,
            email: form.email,
            roleId: Number(form.roleId),
            ...(form.password ? { password: form.password } : {}),
          }),
        });
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserRow) {
    setError('');
    try {
      await api(`/api/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Users</h1>
          <p className="mt-1 text-sm text-slate-500">Manage user accounts and their roles.</p>
        </div>
        <button
          onClick={() => setForm(emptyForm)}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Add User
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {form && (
        <form
          onSubmit={save}
          className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-5"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600">Full name</label>
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              {form.id === null ? 'Password' : 'New password (optional)'}
            </label>
            <input
              type="password"
              required={form.id === null}
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Role</label>
            <select
              required
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Select role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">{u.fullName}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {u.role.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() =>
                      setForm({
                        id: u.id,
                        fullName: u.fullName,
                        email: u.email,
                        password: '',
                        roleId: String(u.role.id),
                      })
                    }
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(u)}
                    className="ml-3 text-xs font-medium text-slate-500 hover:underline"
                  >
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
