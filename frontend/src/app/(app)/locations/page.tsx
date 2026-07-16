'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Drawer } from '@/components/ui/drawer';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';

const TYPES = ['Retail', 'Warehouse', 'Dispensary', 'Other'];

const input =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';

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
  const toast = useToast();
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRow, setConfirmRow] = useState<LocationRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const { sortBy, sortDir, toggle } = useSort('name');

  const load = useCallback(async (search: string, pageNum: number, size: number, sBy: string, sDir: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size), sortBy: sBy, sortDir: sDir });
      if (search) params.set('q', search);
      const d = await api<{ locations: LocationRow[]; total: number }>(`/api/locations?${params}`);
      setRows(d.locations);
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
      const body = JSON.stringify({
        name: form.name,
        type: form.type,
        address: form.address,
        contactPerson: form.contactPerson || null,
      });
      if (form.id === null) {
        await api('/api/locations', { method: 'POST', body });
        toast.success(`Location "${form.name}" created.`);
      } else {
        await api(`/api/locations/${form.id}`, { method: 'PATCH', body });
        toast.success(`Location "${form.name}" updated.`);
      }
      setForm(null);
      await load(q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: LocationRow) {
    try {
      await api(`/api/locations/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      toast.success(`"${row.name}" ${row.isActive ? 'deactivated' : 'activated'}.`);
      await load(q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function remove() {
    if (!confirmRow) return;
    setConfirmBusy(true);
    try {
      await api(`/api/locations/${confirmRow.id}`, { method: 'DELETE' });
      toast.success(`Location "${confirmRow.name}" deleted.`);
      setConfirmRow(null);
      await load(q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setConfirmRow(null);
    } finally {
      setConfirmBusy(false);
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
          <SearchInput
            onSearch={(term) => {
              setQ(term);
              setPage(1);
            }}
            placeholder="Search locations…"
            className="w-56"
          />
          <button
            onClick={() => setForm(emptyForm)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Add Location
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortableHeader label="Name" sortKey="name" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Type" sortKey="type" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Address" sortKey="address" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <th className="px-4 py-3">Contact Person</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={5} cols={6} />}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title={q ? 'No locations match your search' : 'No locations yet'}
                    description={
                      q
                        ? 'Try a different name or address.'
                        : 'Add your first warehouse, store or dispensary to start receiving stock.'
                    }
                    action={q ? undefined : { label: '+ Add Location', onClick: () => setForm(emptyForm) }}
                  />
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
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
                    <button
                      onClick={() => setConfirmRow(row)}
                      className="ml-3 text-xs font-medium text-red-600 hover:underline"
                    >
                      Delete
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
        title={form?.id == null ? 'Add Location' : 'Edit Location'}
        subtitle="Warehouses, retail stores and dispensaries"
        width="md"
      >
        {form && (
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className={label}>Location name *</label>
              <input required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Type *</label>
              <select value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })} className={input}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Full address *</label>
              <input required value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Contact person</label>
              <input value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className={input} />
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

      <ConfirmDialog
        open={confirmRow !== null}
        title="Delete location?"
        message={
          <>
            <span className="font-medium text-slate-900">{confirmRow?.name}</span> will be permanently
            deleted. Locations with stock or transaction history cannot be deleted — deactivate them instead.
          </>
        }
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onConfirm={remove}
        onCancel={() => setConfirmRow(null)}
      />
    </div>
  );
}
