'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

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
  const [tab, setTab] = useState<'credits' | 'payments'>('credits');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [creditRows, setCreditRows] = useState<CreditRow[]>([]);
  const [showSettled, setShowSettled] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payForm, setPayForm] = useState<PayForm | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSummary = useCallback(async (f: string, t: string) => {
    const params = new URLSearchParams();
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    setSummary(await api<Summary>(`/api/wallet/summary?${params}`));
  }, []);

  const loadCredits = useCallback(async (settled: boolean) => {
    const d = await api<{ credits: CreditRow[] }>(`/api/wallet/credits?pageSize=50${settled ? '&settled=true' : ''}`);
    setCreditRows(d.credits);
  }, []);

  const loadPayments = useCallback(async () => {
    const d = await api<{ payments: PaymentRow[] }>('/api/wallet/payments?pageSize=50');
    setPayments(d.payments);
  }, []);

  useEffect(() => {
    loadSummary(from, to).catch((e) => setError(e.message));
  }, [from, to, loadSummary]);

  useEffect(() => {
    setError('');
    if (tab === 'credits') loadCredits(showSettled).catch((e) => setError(e.message));
    else loadPayments().catch((e) => setError(e.message));
  }, [tab, showSettled, loadCredits, loadPayments]);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payForm) return;
    setError('');
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
      setNotice(
        `Payment recorded for ${payForm.row.dspNumber} — outstanding is now ${money(result.outstandingAfter)}.`,
      );
      setPayForm(null);
      await Promise.all([loadCredits(showSettled), loadSummary(from, to)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSaving(false);
    }
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
            <label className={label}>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 ${input}`} />
          </div>
          <div>
            <label className={label}>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 ${input}`} />
          </div>
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo(''); }} className={btnGhost}>Clear</button>
          )}
        </div>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{notice}</p>
      )}

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
            onClick={() => { setTab(t); setNotice(''); }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t === 'credits' ? 'Outstanding Credits' : 'Payment History'}
          </button>
        ))}
      </div>

      {tab === 'credits' && (
        <div>
          {payForm && (
            <form onSubmit={submitPayment} className="mt-4 rounded-lg border border-slate-900 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Record Payment — {payForm.row.dspNumber} (outstanding {money(payForm.row.outstanding)})
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className={label}>Amount *</label>
                  <input required type="number" min="0.01" max={payForm.row.outstanding} step="0.01"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    className={`mt-1 w-full ${input}`} />
                </div>
                <div>
                  <label className={label}>Method</label>
                  <select value={payForm.method}
                    onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                    className={`mt-1 w-full ${input}`}>
                    {METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
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
              </div>
              <div className="mt-5 flex gap-2">
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? 'Saving…' : 'Record Payment'}
                </button>
                <button type="button" onClick={() => setPayForm(null)} className={btnGhost}>Cancel</button>
              </div>
            </form>
          )}

          <div className="mt-4 flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)}
                className="accent-slate-900" />
              Show settled credit sales too
            </label>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">DSP No.</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Date · By</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  {hasPermission('finance.manage') && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {creditRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No outstanding credit sales — everything is collected.
                    </td>
                  </tr>
                )}
                {creditRows.map((r) => (
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
                            onClick={() => {
                              setPayForm({ row: r, amount: String(r.outstanding), method: 'CASH', reference: '', notes: '' });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
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
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Sale</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Received By</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No payments recorded yet.</td></tr>
              )}
              {payments.map((p) => (
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
    </div>
  );
}
