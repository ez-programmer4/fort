'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface BankAccount {
  bankName: string;
  accountNumber: string;
}

interface SupplierRow {
  id: number;
  name: string;
  tin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bankAccounts: BankAccount[];
  isActive: boolean;
}

interface FormState {
  id: number | null;
  name: string;
  tin: string;
  phone: string;
  email: string;
  address: string;
  bankAccounts: BankAccount[];
}

const emptyForm: FormState = {
  id: null,
  name: '',
  tin: '',
  phone: '',
  email: '',
  address: '',
  bankAccounts: [],
};

export default function SuppliersPage() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (search = '') => {
    const data = await api<{ suppliers: SupplierRow[] }>(
      `/api/suppliers${search ? `?q=${encodeURIComponent(search)}` : ''}`,
    );
    setRows(data.suppliers);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(q).catch((e) => setError(e.message)), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: form.name,
        tin: form.tin || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        bankAccounts: form.bankAccounts,
      });
      if (form.id === null) {
        await api('/api/suppliers', { method: 'POST', body });
      } else {
        await api(`/api/suppliers/${form.id}`, { method: 'PATCH', body });
      }
      setForm(null);
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: SupplierRow) {
    setError('');
    try {
      await api(`/api/suppliers/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  function setBank(i: number, patch: Partial<BankAccount>) {
    if (!form) return;
    const next = form.bankAccounts.map((b, idx) => (idx === i ? { ...b, ...patch } : b));
    setForm({ ...form, bankAccounts: next });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vendors you purchase from — linked to products and purchase orders.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, TIN, phone…"
            className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
          <button
            onClick={() => setForm(emptyForm)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Add Supplier
          </button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {form && (
        <form onSubmit={save} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <label className="block text-xs font-medium text-slate-600">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">TIN</label>
              <input
                value={form.tin}
                onChange={(e) => setForm({ ...form, tin: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Bank accounts</label>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    bankAccounts: [...form.bankAccounts, { bankName: '', accountNumber: '' }],
                  })
                }
                className="text-xs font-medium text-slate-900 underline underline-offset-2"
              >
                + Add bank account
              </button>
            </div>
            {form.bankAccounts.map((b, i) => (
              <div key={i} className="mt-2 flex gap-2">
                <input
                  placeholder="Bank name"
                  value={b.bankName}
                  onChange={(e) => setBank(i, { bankName: e.target.value })}
                  className="w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
                />
                <input
                  placeholder="Account number"
                  value={b.accountNumber}
                  onChange={(e) => setBank(i, { accountNumber: e.target.value })}
                  className="w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      bankAccounts: form.bankAccounts.filter((_, idx) => idx !== i),
                    })
                  }
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">TIN</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Bank Accounts</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  No suppliers yet — add your first vendor.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                <td className="px-4 py-3 text-slate-600">{row.tin || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{row.phone || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{row.email || '—'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.bankAccounts.length
                    ? row.bankAccounts.map((b) => `${b.bankName} ${b.accountNumber}`).join(', ')
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() =>
                      setForm({
                        id: row.id,
                        name: row.name,
                        tin: row.tin || '',
                        phone: row.phone || '',
                        email: row.email || '',
                        address: row.address || '',
                        bankAccounts: row.bankAccounts || [],
                      })
                    }
                    className="text-xs font-medium text-slate-900 underline underline-offset-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(row)}
                    className="ml-3 text-xs font-medium text-slate-500 hover:underline"
                  >
                    {row.isActive ? 'Deactivate' : 'Activate'}
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
