'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const TYPES = ['Retail', 'Warehouse', 'Dispensary', 'Other'];

interface LocationRow {
  id: number;
  name: string;
  type: string;
  address: string;
  contactPerson: string | null;
  isActive: boolean;
}

interface FormState {
  id: number | null;
  name: string;
  type: string;
  address: string;
  contactPerson: string;
}

const emptyForm: FormState = { id: null, name: '', type: 'Retail', address: '', contactPerson: '' };

export default function LocationsPage() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (search = '') => {
    const data = await api<{ locations: LocationRow[] }>(
      `/api/locations${search ? `?q=${encodeURIComponent(search)}` : ''}`,
    );
    setRows(data.locations);
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
        type: form.type,
        address: form.address,
        contactPerson: form.contactPerson || null,
      });
      if (form.id === null) {
        await api('/api/locations', { method: 'POST', body });
      } else {
        await api(`/api/locations/${form.id}`, { method: 'PATCH', body });
      }
      setForm(null);
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: LocationRow) {
    setError('');
    try {
      await api(`/api/locations/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Locations</h1>
          <p className="mt-1 text-sm text-slate-500">Warehouses, retail stores and dispensaries.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search locations…"
            className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
          <button
            onClick={() => setForm(emptyForm)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Add Location
          </button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {form && (
        <form
          onSubmit={save}
          className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-5"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600">Location name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Type *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Full address *</label>
            <input
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Contact person</label>
            <input
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
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
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Contact Person</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  No locations yet — add your first warehouse or store.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                    {row.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.address}</td>
                <td className="px-4 py-3 text-slate-600">{row.contactPerson || '—'}</td>
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
                        type: row.type,
                        address: row.address,
                        contactPerson: row.contactPerson || '',
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
