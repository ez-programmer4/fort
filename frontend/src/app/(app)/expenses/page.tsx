'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppSettings, useSettings } from '@/lib/settings';
import { Drawer } from '@/components/ui/drawer';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Combobox } from '@/components/ui/combobox';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';

const input =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';
const btnPrimary =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50';
const btnGhost =
  'rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50';

const WHT_OPTIONS = [
  { value: 'NONE', label: 'No withholding', defaultRate: 0 },
  { value: 'GOODS', label: 'Goods', defaultRate: 2 },
  { value: 'SERVICES', label: 'Services', defaultRate: 2 },
];

function whtRateFor(value: string, settings: AppSettings | null): number {
  if (value === 'GOODS') return settings?.whtGoodsRate ?? 2;
  if (value === 'SERVICES') return settings?.whtServicesRate ?? 2;
  return 0;
}

function money(v: string | number) {
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Option {
  id: number;
  name: string;
  isActive: boolean;
}

interface Expense {
  id: number;
  description: string;
  category: string | null;
  amount: string;
  withholdingType: string;
  withholdingAmount: string;
  netPayable: string;
  purchasedAt: string;
  supplier: { name: string } | null;
  createdBy: { fullName: string };
}

const emptyExpense = { description: '', category: '', supplierId: '', amount: '', whtType: 'NONE', whtRate: '0', notes: '' };

export default function ExpensesPage() {
  const toast = useToast();
  const settings = useSettings();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const { sortBy, sortDir, toggle } = useSort('purchasedAt', 'desc');

  const [exp, setExp] = useState(emptyExpense);
  const [expSaving, setExpSaving] = useState(false);

  const load = useCallback(async (search: string, pageNum: number, size: number, sBy: string, sDir: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size), sortBy: sBy, sortDir: sDir });
      if (search) params.set('q', search);
      const d = await api<{ expenses: Expense[]; total: number }>(`/api/procurement/expenses?${params}`);
      setExpenses(d.expenses);
      setTotal(d.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api<{ suppliers: Option[] }>('/api/suppliers')
      .then((s) => setSuppliers(s.suppliers))
      .catch((e) => toast.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load(q, page, pageSize, sortBy, sortDir).catch((e) => toast.error(e.message));
  }, [q, page, pageSize, sortBy, sortDir, load]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    setExpSaving(true);
    try {
      await api('/api/procurement/expenses', {
        method: 'POST',
        body: JSON.stringify({
          description: exp.description,
          category: exp.category || null,
          supplierId: exp.supplierId ? Number(exp.supplierId) : null,
          amount: Number(exp.amount),
          withholdingType: exp.whtType,
          withholdingRate: Number(exp.whtRate) || 0,
          notes: exp.notes || null,
        }),
      });
      toast.success('Purchase recorded.');
      setShowNewExpense(false);
      setExp(emptyExpense);
      await load(q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setExpSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">
            Office supplies, services and other non-sale purchases — not tied to a purchase order or GRV.
          </p>
        </div>
        <button onClick={() => setShowNewExpense(true)} className={btnPrimary}>+ Record Purchase</button>
      </div>

      <div className="mt-5">
        <SearchInput
          onSearch={(term) => {
            setQ(term);
            setPage(1);
          }}
          placeholder="Search description, category…"
          className="w-72"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortableHeader label="Description" sortKey="description" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Category" sortKey="category" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Supplier" sortKey="supplier" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Amount" sortKey="amount" sortBy={sortBy} sortDir={sortDir} onSort={toggle} align="right" />
              <SortableHeader label="Withholding" sortKey="withholdingAmount" sortBy={sortBy} sortDir={sortDir} onSort={toggle} align="right" />
              <SortableHeader label="Net Payable" sortKey="netPayable" sortBy={sortBy} sortDir={sortDir} onSort={toggle} align="right" />
              <SortableHeader label="Date" sortKey="purchasedAt" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="By" sortKey="createdBy" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={5} cols={8} />}
            {!loading && expenses.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title={q ? 'No purchases match your search' : 'No non-sale purchases recorded'}
                    description={q ? 'Try a different description or category.' : 'Record office supplies and other non-sale purchases here.'}
                    action={q ? undefined : { label: '+ Record Purchase', onClick: () => setShowNewExpense(true) }}
                  />
                </td>
              </tr>
            )}
            {!loading &&
              expenses.map((x) => (
                <tr key={x.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{x.description}</td>
                  <td className="px-4 py-3 text-slate-600">{x.category || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{x.supplier?.name || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(x.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {x.withholdingType === 'NONE' ? '—' : `−${money(x.withholdingAmount)}`}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">{money(x.netPayable)}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(x.purchasedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-500">{x.createdBy.fullName}</td>
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
        open={showNewExpense}
        onClose={() => setShowNewExpense(false)}
        title="Record Non-Sale Purchase"
        subtitle="Office supplies, services and other expenses"
        width="md"
      >
        {showNewExpense && (
          <form onSubmit={saveExpense} className="space-y-4" noValidate>
            <div>
              <label className={label}>Description *</label>
              <input required value={exp.description}
                onChange={(e) => setExp({ ...exp, description: e.target.value })}
                placeholder="e.g. Office supplies — printer paper"
                className={`mt-1 w-full ${input}`} />
            </div>
            <div>
              <label className={label}>Category</label>
              <input value={exp.category}
                onChange={(e) => setExp({ ...exp, category: e.target.value })}
                placeholder="Office supplies" className={`mt-1 w-full ${input}`} />
            </div>
            <div>
              <label className={label}>Supplier</label>
              <Combobox
                options={suppliers.filter((s) => s.isActive).map((s) => ({ value: String(s.id), label: s.name }))}
                value={exp.supplierId}
                onChange={(v) => setExp({ ...exp, supplierId: v })}
                placeholder="Search supplier…"
                className="mt-1"
              />
            </div>
            <div>
              <label className={label}>Amount *</label>
              <input required type="number" min="0.01" step="0.01" value={exp.amount}
                onChange={(e) => setExp({ ...exp, amount: e.target.value })} className={`mt-1 w-full ${input}`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Withholding</label>
                <Select
                  value={exp.whtType}
                  onChange={(v) => {
                    const opt = WHT_OPTIONS.find((o) => o.value === v)!;
                    setExp({ ...exp, whtType: opt.value, whtRate: String(whtRateFor(opt.value, settings)) });
                  }}
                  options={WHT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  className="mt-1"
                />
              </div>
              {exp.whtType !== 'NONE' && (
                <div>
                  <label className={label}>Rate %</label>
                  <input type="number" min="0" max="100" step="0.01" value={exp.whtRate}
                    onChange={(e) => setExp({ ...exp, whtRate: e.target.value })} className={`mt-1 w-full ${input}`} />
                </div>
              )}
            </div>
            <div>
              <label className={label}>Notes</label>
              <input value={exp.notes} onChange={(e) => setExp({ ...exp, notes: e.target.value })}
                className={`mt-1 w-full ${input}`} />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={expSaving} className={btnPrimary}>
                {expSaving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowNewExpense(false)} className={btnGhost}>Cancel</button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
