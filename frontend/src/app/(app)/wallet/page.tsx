'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Drawer } from '@/components/ui/drawer';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { DateRangePicker } from '@/components/ui/date-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';
import { Select } from '@/components/ui/select';

const input =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';
const btnPrimary =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50';
const btnGhost =
  'rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50';

function money(v: string | number) {
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'MOBILE', label: 'Mobile money' },
];

interface Summary {
  totalSales: number;
  cashSales: number;
  creditSales: number;
  salesCount: number;
  paymentsReceived: number;
  outstanding: number;
  withholdingOnSales: number;
}

interface CreditRow {
  id: number;
  dspNumber: string;
  location: string;
  dispensedBy: string;
  createdAt: string;
  total: number;
  paid: number;
  outstanding: number;
}

interface PaymentRow {
  id: number;
  amount: string;
  method: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  dispenseOrder: { dspNumber: string; total: string };
  receivedBy: { fullName: string };
}

interface PayForm {
  row: CreditRow;
  amount: string;
  method: string;
  reference: string;
  notes: string;
}

export default function WalletPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'credits' | 'payments'>('credits');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [creditRows, setCreditRows] = useState<CreditRow[]>([]);
  const [showSettled, setShowSettled] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payForm, setPayForm] = useState<PayForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { sortBy, sortDir, toggle, reset: resetSort } = useSort('createdAt', 'desc');

  const loadSummary = useCallback(async (f: string, t: string) => {
    const params = new URLSearchParams();
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    setSummary(await api<Summary>(`/api/wallet/summary?${params}`));
  }, []);

  const loadCredits = useCallback(async (settled: boolean, search: string, pageNum: number, size: number, sBy: string, sDir: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size), sortBy: sBy, sortDir: sDir });
      if (settled) params.set('settled', 'true');
      if (search) params.set('q', search);
      const d = await api<{ credits: CreditRow[]; total: number }>(`/api/wallet/credits?${params}`);
      setCreditRows(d.credits);
      setTotal(d.total);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPayments = useCallback(async (search: string, pageNum: number, size: number, sBy: string, sDir: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size), sortBy: sBy, sortDir: sDir });
      if (search) params.set('q', search);
      const d = await api<{ payments: PaymentRow[]; total: number }>(`/api/wallet/payments?${params}`);
      setPayments(d.payments);
      setTotal(d.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary(from, to).catch((e) => toast.error(e.message));
  }, [from, to, loadSummary]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'credits') loadCredits(showSettled, q, page, pageSize, sortBy, sortDir).catch((e) => toast.error(e.message));
    else loadPayments(q, page, pageSize, sortBy, sortDir).catch((e) => toast.error(e.message));
  }, [tab, showSettled, q, page, pageSize, sortBy, sortDir, loadCredits, loadPayments]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payForm) return;
    setSaving(true);
    try {
      const result = await api<{ outstandingAfter: number }>('/api/wallet/payments', {
        method: 'POST',
        body: JSON.stringify({
          dispenseOrderId: payForm.row.id,
          amount: Number(payForm.amount),
          method: payForm.method,
          reference: payForm.reference || null,
          notes: payForm.notes || null,
        }),
      });
      toast.success(
        `Payment recorded for ${payForm.row.dspNumber} — outstanding is now ${money(result.outstandingAfter)}.`,
      );
      setPayForm(null);
      await Promise.all([loadCredits(showSettled, q, page, pageSize, sortBy, sortDir), loadSummary(from, to)]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSaving(false);
    }
  }

  function switchTab(t: 'credits' | 'payments') {
    setTab(t);
    setQ('');
    setPage(1);
    resetSort('createdAt', 'desc');
  }

  const cards = summary
    ? [
        { title: 'Total Sales', value: summary.totalSales, sub: `${summary.salesCount} sale(s)` },
        { title: 'Cash Sales', value: summary.cashSales, sub: 'settled at sale' },
        { title: 'Credit Sales', value: summary.creditSales, sub: 'sold on credit' },
        { title: 'Payments Received', value: summary.paymentsReceived, sub: 'against credit sales' },
        { title: 'Outstanding', value: summary.outstanding, sub: 'still to collect', highlight: summary.outstanding > 0 },
        { title: 'WHT on Sales', value: summary.withholdingOnSales, sub: 'withheld by buyers' },
      ]
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Wallet</h1>
          <p className="mt-1 text-sm text-slate-500">Sales money — cash, credit, payments and balances.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className={label}>Date range</label>
            <DateRangePicker
              from={from}
              to={to}
              onChange={(r) => {
                setFrom(r.from);
                setTo(r.to);
              }}
              placeholder="All time"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div
            key={c.title}
            className={`rounded-lg border bg-white p-4 ${c.highlight ? 'border-slate-900' : 'border-slate-200'}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.title}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{money(c.value)}</p>
            <p className="text-[11px] text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {(['credits', 'payments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t === 'credits' ? 'Outstanding Credits' : 'Payment History'}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchInput
          key={tab}
          onSearch={(term) => {
            setQ(term);
            setPage(1);
          }}
          placeholder={tab === 'credits' ? 'Search DSP no…' : 'Search DSP no. or reference…'}
          className="w-64"
        />
        {tab === 'credits' && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showSettled}
              onChange={(e) => {
                setShowSettled(e.target.checked);
                setPage(1);
              }}
              className="accent-slate-900"
            />
            Show settled credit sales too
          </label>
        )}
      </div>

      {tab === 'credits' && (
        <div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <SortableHeader label="DSP No." sortKey="dspNumber" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                  <SortableHeader label="Location" sortKey="location" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                  <SortableHeader label="Date · By" sortKey="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                  <SortableHeader label="Total" sortKey="total" sortBy={sortBy} sortDir={sortDir} onSort={toggle} align="right" />
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  {hasPermission('finance.manage') && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonRows rows={5} cols={hasPermission('finance.manage') ? 7 : 6} />}
                {!loading && creditRows.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title={q ? 'No credit sales match your search' : 'No outstanding credit sales'}
                        description={q ? 'Try a different DSP number.' : 'Everything is collected.'}
                      />
                    </td>
                  </tr>
                )}
                {!loading &&
                  creditRows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-slate-900">{r.dspNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{r.location}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(r.createdAt).toLocaleDateString()} · {r.dispensedBy}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(r.total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{money(r.paid)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                        {money(r.outstanding)}
                        {r.outstanding === 0 && (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Settled
                          </span>
                        )}
                      </td>
                      {hasPermission('finance.manage') && (
                        <td className="px-4 py-3 text-right">
                          {r.outstanding > 0 && (
                            <button
                              onClick={() =>
                                setPayForm({ row: r, amount: String(r.outstanding), method: 'CASH', reference: '', notes: '' })
                              }
                              className="text-xs font-medium text-slate-900 underline underline-offset-2"
                            >
                              Record payment
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <SortableHeader label="Date" sortKey="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Sale" sortKey="dspNumber" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Amount" sortKey="amount" sortBy={sortBy} sortDir={sortDir} onSort={toggle} align="right" />
                <SortableHeader label="Method" sortKey="method" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Reference" sortKey="reference" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <th className="px-4 py-3">Received By</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={5} cols={7} />}
              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title={q ? 'No payments match your search' : 'No payments recorded yet'}
                      description={q ? 'Try a different DSP number or reference.' : 'Payments recorded against credit sales will appear here.'}
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-500">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-900">{p.dispenseOrder.dspNumber}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{money(p.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {METHODS.find((m) => m.value === p.method)?.label || p.method}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.reference || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.receivedBy.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{p.notes || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

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
        open={payForm !== null}
        onClose={() => setPayForm(null)}
        title="Record Payment"
        subtitle={payForm ? `${payForm.row.dspNumber} — outstanding ${money(payForm.row.outstanding)}` : undefined}
        width="md"
      >
        {payForm && (
          <form onSubmit={submitPayment} className="space-y-4" noValidate>
            <div>
              <label className={label}>Amount *</label>
              <input required type="number" min="0.01" max={payForm.row.outstanding} step="0.01"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                className={`mt-1 w-full ${input}`} />
            </div>
            <div>
              <label className={label}>Method</label>
              <Select
                value={payForm.method}
                onChange={(v) => setPayForm({ ...payForm, method: v })}
                options={METHODS}
                className="mt-1"
              />
            </div>
            <div>
              <label className={label}>Reference</label>
              <input value={payForm.reference} placeholder="Receipt / TXN no."
                onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                className={`mt-1 w-full ${input}`} />
            </div>
            <div>
              <label className={label}>Notes</label>
              <input value={payForm.notes}
                onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                className={`mt-1 w-full ${input}`} />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
              <button type="button" onClick={() => setPayForm(null)} className={btnGhost}>Cancel</button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
