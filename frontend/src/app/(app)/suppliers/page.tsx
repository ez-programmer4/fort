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

const input =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';

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
  const toast = useToast();
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRow, setConfirmRow] = useState<SupplierRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const { sortBy, sortDir, toggle } = useSort('name');

  const load = useCallback(async (search: string, pageNum: number, size: number, sBy: string, sDir: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size), sortBy: sBy, sortDir: sDir });
      if (search) params.set('q', search);
      const d = await api<{ suppliers: SupplierRow[]; total: number }>(`/api/suppliers?${params}`);
      setRows(d.suppliers);
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
        tin: form.tin || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        bankAccounts: form.bankAccounts,
      });
      if (form.id === null) {
        await api('/api/suppliers', { method: 'POST', body });
        toast.success(`Supplier "${form.name}" created.`);
      } else {
        await api(`/api/suppliers/${form.id}`, { method: 'PATCH', body });
        toast.success(`Supplier "${form.name}" updated.`);
      }
      setForm(null);
      await load(q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: SupplierRow) {
    try {
      await api(`/api/suppliers/${row.id}`, {
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
      await api(`/api/suppliers/${confirmRow.id}`, { method: 'DELETE' });
      toast.success(`Supplier "${confirmRow.name}" deleted.`);
      setConfirmRow(null);
      await load(q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setConfirmRow(null);
    } finally {
      setConfirmBusy(false);
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
          <SearchInput
            onSearch={(term) => {
              setQ(term);
              setPage(1);
            }}
            placeholder="Search name, TIN, phone…"
            className="w-56"
          />
          <button
            onClick={() => setForm(emptyForm)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Add Supplier
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortableHeader label="Name" sortKey="name" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="TIN" sortKey="tin" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Phone" sortKey="phone" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Bank Accounts</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={5} cols={7} />}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title={q ? 'No suppliers match your search' : 'No suppliers yet'}
                    description={
                      q
                        ? 'Try a different name, TIN or phone number.'
                        : 'Add your first vendor to link products and purchase orders.'
                    }
                    action={q ? undefined : { label: '+ Add Supplier', onClick: () => setForm(emptyForm) }}
                  />
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
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
        title={form?.id == null ? 'Add Supplier' : 'Edit Supplier'}
        subtitle="Vendor details and bank accounts"
        width="lg"
      >
        {form && (
          <form onSubmit={save} className="space-y-4" noValidate>
            <div>
              <label className={label}>Name *</label>
              <input required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>TIN</label>
                <input value={form.tin}
                  onChange={(e) => setForm({ ...form, tin: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Phone</label>
                <input value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
              </div>
            </div>
            <div>
              <label className={label}>Email</label>
              <input type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Address</label>
              <input value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} className={input} />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <label className={label}>Bank accounts</label>
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
                <div key={i} className="mt-2 flex items-center gap-2">
                  <input
                    placeholder="Bank name"
                    value={b.bankName}
                    onChange={(e) => setBank(i, { bankName: e.target.value })}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                  />
                  <input
                    placeholder="Account number"
                    value={b.accountNumber}
                    onChange={(e) => setBank(i, { accountNumber: e.target.value })}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        bankAccounts: form.bankAccounts.filter((_, idx) => idx !== i),
                      })
                    }
                    className="shrink-0 text-xs text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
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
        title="Delete supplier?"
        message={
          <>
            <span className="font-medium text-slate-900">{confirmRow?.name}</span> will be permanently
            deleted. Suppliers linked to products or purchases cannot be deleted — deactivate them instead.
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
