'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Drawer } from '@/components/ui/drawer';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';
import { Select } from '@/components/ui/select';

const input =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';

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
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const { sortBy, sortDir, toggle } = useSort('fullName');

  useEffect(() => {
    api<{ roles: RoleOption[] }>('/api/roles')
      .then((r) => setRoles(r.roles))
      .catch((e) => toast.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (search: string, pageNum: number, size: number, sBy: string, sDir: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size), sortBy: sBy, sortDir: sDir });
      if (search) params.set('q', search);
      const d = await api<{ users: UserRow[]; total: number }>(`/api/users?${params}`);
      setUsers(d.users);
      setTotal(d.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(q, page, pageSize, sortBy, sortDir).catch((e) => toast.error(e.message));
  }, [q, page, pageSize, sortBy, sortDir, load]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
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
        toast.success(`User "${form.fullName}" created.`);
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
        toast.success(`User "${form.fullName}" updated.`);
      }
      setForm(null);
      await load(q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserRow) {
    try {
      await api(`/api/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      toast.success(`"${u.fullName}" ${u.isActive ? 'deactivated' : 'activated'}.`);
      await load(q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">Manage user accounts and their roles.</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchInput
            onSearch={(term) => {
              setQ(term);
              setPage(1);
            }}
            placeholder="Search name or email…"
            className="w-56"
          />
          <button
            onClick={() => setForm(emptyForm)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Add User
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortableHeader label="Name" sortKey="fullName" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Email" sortKey="email" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Role" sortKey="role" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <th className="px-4 py-3">Status</th>
              <SortableHeader label="Created" sortKey="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={5} cols={6} />}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title={q ? 'No users match your search' : 'No users yet'}
                    description={q ? 'Try a different name or email.' : 'Add the first user account.'}
                    action={q ? undefined : { label: '+ Add User', onClick: () => setForm(emptyForm) }}
                  />
                </td>
              </tr>
            )}
            {!loading &&
              users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {u.role.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
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
                      className="text-xs font-medium text-slate-900 underline underline-offset-2"
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

      <div className="mt-4">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>

      <Drawer
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id == null ? 'Add User' : 'Edit User'}
        subtitle="Account details and role assignment"
        width="md"
      >
        {form && (
          <form onSubmit={save} className="space-y-4" noValidate>
            <div>
              <label className={label}>Full name *</label>
              <input required value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Email *</label>
              <input required type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>
                {form.id === null ? 'Password *' : 'New password (leave blank to keep current)'}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={input}
              />
              <p className="mt-0.5 text-[11px] text-slate-400">At least 6 characters.</p>
            </div>
            <div>
              <label className={label}>Role *</label>
              <Select
                value={form.roleId}
                onChange={(v) => setForm({ ...form, roleId: v })}
                placeholder="Select role…"
                options={roles.map((r) => ({ value: String(r.id), label: r.name }))}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
