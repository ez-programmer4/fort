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
import { Select } from '@/components/ui/select';

const input =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';

type Rating = 'UNRATED' | 'GOOD' | 'FAIR' | 'POOR';

const RATING_META: Record<Rating, { label: string; badge: string }> = {
  UNRATED: { label: 'Unrated', badge: 'bg-slate-100 text-slate-600' },
  GOOD: { label: 'Good', badge: 'bg-emerald-50 text-emerald-700' },
  FAIR: { label: 'Fair', badge: 'bg-amber-50 text-amber-700' },
  POOR: { label: 'Poor', badge: 'bg-red-50 text-red-700' },
};
const RATING_OPTIONS = (Object.keys(RATING_META) as Rating[]).map((r) => ({ value: r, label: RATING_META[r].label }));

function money(v: number) {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface BankAccount {
  bankName: string;
  accountNumber: string;
}

interface CustomerRow {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  bankAccounts: BankAccount[];
  creditRating: Rating;
  isActive: boolean;
  createdAt: string;
  _count?: { dispenseOrders: number };
}

interface FormState {
  id: number | null;
  name: string;
  phone: string;
  email: string;
  bankAccounts: BankAccount[];
  creditRating: Rating;
}

interface CreditSummary {
  creditRating: Rating;
  totalOrders: number;
  creditOrderCount: number;
  settledCount: number;
  outstandingCount: number;
  totalCreditAmount: number;
  totalPaid: number;
  outstanding: number;
  lastOrderAt: string | null;
}

const emptyForm: FormState = { id: null, name: '', phone: '', email: '', bankAccounts: [], creditRating: 'UNRATED' };

export default function CustomersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRow, setConfirmRow] = useState<CustomerRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const { sortBy, sortDir, toggle } = useSort('name');

  const load = useCallback(async (search: string, pageNum: number, size: number, sBy: string, sDir: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size), sortBy: sBy, sortDir: sDir });
      if (search) params.set('q', search);
      const d = await api<{ customers: CustomerRow[]; total: number }>(`/api/customers?${params}`);
      setRows(d.customers);
      setTotal(d.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(q, page, pageSize, sortBy, sortDir).catch((e) => toast.error(e.message));
  }, [q, page, pageSize, sortBy, sortDir, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Payment-history summary — the data staff use to decide what to set the
  // rating to. Only exists for an existing customer, not while creating one.
  useEffect(() => {
    if (!form?.id) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    api<CreditSummary>(`/api/customers/${form.id}/credit-summary`)
      .then(setSummary)
      .catch((e) => toast.error(e.message))
      .finally(() => setSummaryLoading(false));
  }, [form?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        bankAccounts: form.bankAccounts,
        creditRating: form.creditRating,
      });
      if (form.id === null) {
        await api('/api/customers', { method: 'POST', body });
        toast.success(`Customer "${form.name}" created.`);
      } else {
        await api(`/api/customers/${form.id}`, { method: 'PATCH', body });
        toast.success(`Customer "${form.name}" updated.`);
      }
      setForm(null);
      await load(q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: CustomerRow) {
    try {
      await api(`/api/customers/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      toast.success(`"${row.name}" ${row.isActive ? 'deactivated' : 'activated'}.`);
      await load(q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  function setBank(i: number, patch: Partial<BankAccount>) {
    if (!form) return;
    const next = form.bankAccounts.map((b, idx) => (idx === i ? { ...b, ...patch } : b));
    setForm({ ...form, bankAccounts: next });
  }

  async function remove() {
    if (!confirmRow) return;
    setConfirmBusy(true);
    try {
      await api(`/api/customers/${confirmRow.id}`, { method: 'DELETE' });
      toast.success(`Customer "${confirmRow.name}" deleted.`);
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
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            People and organizations you dispense to — created here or quick-added during a sale.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchInput
            onSearch={(term) => {
              setQ(term);
              setPage(1);
            }}
            placeholder="Search name, phone, email…"
            className="w-64"
          />
          <button
            onClick={() => setForm(emptyForm)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Add Customer
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortableHeader label="Name" sortKey="name" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Phone" sortKey="phone" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Bank Accounts</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3 text-right">Orders</th>
              <SortableHeader label="Added" sortKey="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={5} cols={9} />}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title={q ? 'No customers match your search' : 'No customers yet'}
                    description={
                      q
                        ? 'Try a different name, phone or email.'
                        : 'Customers are usually added inline while dispensing — or add one here.'
                    }
                    action={q ? undefined : { label: '+ Add Customer', onClick: () => setForm(emptyForm) }}
                  />
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.bankAccounts?.length
                      ? row.bankAccounts.map((b) => `${b.bankName} ${b.accountNumber}`).join(', ')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RATING_META[row.creditRating].badge}`}>
                      {RATING_META[row.creditRating].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{row._count?.dispenseOrders ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</td>
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
                          phone: row.phone || '',
                          email: row.email || '',
                          bankAccounts: row.bankAccounts || [],
                          creditRating: row.creditRating,
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
        title={form?.id == null ? 'Add Customer' : 'Edit Customer'}
        subtitle="Contact details for dispensing and sales history"
        width="md"
      >
        {form && (
          <form onSubmit={save} className="space-y-4" noValidate>
            <div>
              <label className={label}>Name *</label>
              <input required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Email</label>
              <input type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
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

            {form.id !== null && (
              <div className="border-t border-slate-200 pt-4">
                <label className={label}>Payment history</label>
                {summaryLoading && (
                  <div className="mt-2 h-16 animate-pulse rounded-md bg-slate-100" />
                )}
                {!summaryLoading && summary && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p><span className="text-slate-500">Credit sales:</span> <span className="text-slate-900">{summary.creditOrderCount}</span></p>
                    <p><span className="text-slate-500">Fully settled:</span> <span className="text-slate-900">{summary.settledCount}</span></p>
                    <p><span className="text-slate-500">Total extended:</span> <span className="tabular-nums text-slate-900">{money(summary.totalCreditAmount)}</span></p>
                    <p><span className="text-slate-500">Total paid:</span> <span className="tabular-nums text-slate-900">{money(summary.totalPaid)}</span></p>
                    <p className="col-span-2">
                      <span className="text-slate-500">Outstanding now:</span>{' '}
                      <span className={`tabular-nums font-semibold ${summary.outstanding > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {money(summary.outstanding)}
                      </span>
                    </p>
                    {summary.lastOrderAt && (
                      <p className="col-span-2 text-xs text-slate-400">
                        Last order {new Date(summary.lastOrderAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-400">Use this history to decide the rating below.</p>
                <div className="mt-3">
                  <label className={label}>Credit rating</label>
                  <Select
                    value={form.creditRating}
                    onChange={(v) => setForm({ ...form, creditRating: v as Rating })}
                    options={RATING_OPTIONS}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

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
        title="Delete customer?"
        message={
          <>
            <span className="font-medium text-slate-900">{confirmRow?.name}</span> will be permanently
            deleted. Customers with sales history cannot be deleted — deactivate them instead.
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
