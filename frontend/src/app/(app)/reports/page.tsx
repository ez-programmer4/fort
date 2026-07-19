'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, apiDownload } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Drawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';

const input =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';
const btnPrimary =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50';
const btnGhost =
  'rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50';

function money(v: number) {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Option {
  id: number;
  name: string;
}

interface Finance {
  salesCount: number;
  totalSales: number;
  withholding: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  paymentsReceived: number;
  cashSales: number;
  paymentsOnCredit: number;
  otherPurchases: number;
}

interface SalesData {
  days: { date: string; count: number; gross: number; net: number; cash: number; credit: number }[];
  totals: { count: number; gross: number; net: number; cash: number; credit: number };
}

interface WithholdingRow {
  id: number;
  dspNumber: string;
  createdAt: string;
  customer: string;
  location: string;
  subtotal: number;
  withholdingType: string;
  withholdingRate: number;
  withholdingAmount: number;
  total: number;
  withholdingReceiptNumber: string | null;
  withholdingReceivedAt: string | null;
}

interface WithholdingData {
  rows: WithholdingRow[];
  totals: { count: number; subtotal: number; withholdingAmount: number; total: number; receivedCount: number };
}

interface ReceiptForm {
  row: WithholdingRow;
  receiptNumber: string;
}

export default function ReportsPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'finance' | 'sales' | 'withholding'>('finance');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [locations, setLocations] = useState<Option[]>([]);
  const [locationId, setLocationId] = useState('');
  const [finance, setFinance] = useState<Finance | null>(null);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [withholding, setWithholding] = useState<WithholdingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiptForm, setReceiptForm] = useState<ReceiptForm | null>(null);
  const [saving, setSaving] = useState(false);

  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (locationId) p.set('locationId', locationId);
    return p.toString();
  }, [from, to, locationId]);

  useEffect(() => {
    api<{ locations: Option[] }>('/api/locations')
      .then((d) => setLocations(d.locations))
      .catch((e) => toast.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    const q = params();
    const req =
      tab === 'finance'
        ? api<Finance>(`/api/reports/finance?${q}`).then(setFinance)
        : tab === 'sales'
        ? api<SalesData>(`/api/reports/sales?${q}`).then(setSales)
        : api<WithholdingData>(`/api/reports/withholding?${q}`).then(setWithholding);
    req.catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [tab, params]); // eslint-disable-line react-hooks/exhaustive-deps

  function downloadPdf() {
    const path = `/api/reports/${tab}.pdf`;
    apiDownload(`${path}?${params()}`, `${tab}-report.pdf`).catch((e) => toast.error(e.message));
  }

  function reloadWithholding() {
    return api<WithholdingData>(`/api/reports/withholding?${params()}`)
      .then(setWithholding)
      .catch((e) => toast.error(e.message));
  }

  async function submitReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!receiptForm) return;
    setSaving(true);
    try {
      await api(`/api/sales/${receiptForm.row.id}/withholding-receipt`, {
        method: 'PATCH',
        body: JSON.stringify({ receiptNumber: receiptForm.receiptNumber }),
      });
      toast.success(
        receiptForm.receiptNumber
          ? `Receipt ${receiptForm.receiptNumber} recorded for ${receiptForm.row.dspNumber}.`
          : `Receipt status cleared for ${receiptForm.row.dspNumber}.`,
      );
      setReceiptForm(null);
      await reloadWithholding();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update receipt status');
    } finally {
      setSaving(false);
    }
  }

  const financeRows = finance
    ? [
        { label: `Total Sales (${finance.salesCount} sales, gross)`, value: finance.totalSales },
        { label: 'Withholding tax on sales', value: finance.withholding === 0 ? 0 : -finance.withholding },
        { label: 'Revenue (net of withholding)', value: finance.revenue, bold: true },
        { label: 'Cost of Goods Sold (COGS)', value: finance.cogs === 0 ? 0 : -finance.cogs },
        { label: 'Gross Profit', value: finance.grossProfit, bold: true },
        { label: 'Payments — cash sales', value: finance.cashSales },
        { label: 'Payments — against credit', value: finance.paymentsOnCredit },
        { label: 'Total payments received', value: finance.paymentsReceived, bold: true },
        { label: 'Non-sale purchases (expenses)', value: finance.otherPurchases === 0 ? 0 : -finance.otherPurchases },
      ]
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Finance and sales reports — preview on screen, download as PDF with logo and signature block.
          </p>
        </div>
        <button onClick={downloadPdf} className={btnPrimary}>Download PDF</button>
      </div>

      <Tabs
        className="mt-5"
        value={tab}
        onChange={(v) => setTab(v as 'finance' | 'sales' | 'withholding')}
        tabs={[
          { key: 'finance', label: 'Finance Report' },
          { key: 'sales', label: 'Sales Report' },
          { key: 'withholding', label: 'Withholding' },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
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
        <div>
          <label className={label}>Location</label>
          <Select
            value={locationId}
            onChange={setLocationId}
            placeholder="All locations"
            options={[{ value: '', label: 'All locations' }, ...locations.map((l) => ({ value: String(l.id), label: l.name }))]}
            className="mt-1 w-48"
          />
        </div>
      </div>

      {tab === 'finance' && (
        <div className="mt-4 max-w-xl rounded-lg border border-slate-200 bg-white p-6">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          )}
          {!loading && finance &&
            financeRows.map((r) => (
              <div
                key={r.label}
                className={`flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0 ${
                  r.bold ? 'font-semibold' : ''
                }`}
              >
                <span className={r.bold ? 'text-slate-900' : 'text-slate-500'}>{r.label}</span>
                <span className={`tabular-nums ${r.value < 0 ? 'text-slate-600' : 'text-slate-900'}`}>
                  {r.value < 0 ? `−${money(Math.abs(r.value))}` : money(r.value)}
                </span>
              </div>
            ))}
        </div>
      )}

      {tab === 'sales' && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Cash</th>
                <th className="px-4 py-3 text-right">Credit</th>
                <th className="px-4 py-3 text-right">Net Revenue</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={6} cols={6} />}
              {!loading && sales && sales.days.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No sales in this period" description="Try widening the date range." />
                  </td>
                </tr>
              )}
              {!loading &&
                sales &&
                sales.days.map((d) => (
                  <tr key={d.date} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 text-slate-900">{new Date(d.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{d.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{money(d.gross)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{money(d.cash)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{money(d.credit)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{money(d.net)}</td>
                  </tr>
                ))}
              {!loading && sales && sales.days.length > 0 && (
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2.5 text-slate-900">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{sales.totals.count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(sales.totals.gross)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(sales.totals.cash)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(sales.totals.credit)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(sales.totals.net)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'withholding' && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">DSP No.</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Withheld</th>
                <th className="px-4 py-3 text-right">Net Total</th>
                <th className="px-4 py-3">Receipt</th>
                {hasPermission('finance.manage') && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={6} cols={hasPermission('finance.manage') ? 10 : 9} />}
              {!loading && withholding && withholding.rows.length === 0 && (
                <tr>
                  <td colSpan={hasPermission('finance.manage') ? 10 : 9}>
                    <EmptyState
                      title="No withheld sales in this period"
                      description="Sales with a withholding type of Goods or Services will show up here."
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                withholding &&
                withholding.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{r.dspNumber}</td>
                    <td className="px-4 py-2.5 text-slate-600">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.customer}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.location}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{money(r.subtotal)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                      {r.withholdingRate}% <span className="text-slate-400">({r.withholdingType.toLowerCase()})</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">−{money(r.withholdingAmount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{money(r.total)}</td>
                    <td className="px-4 py-2.5">
                      {r.withholdingReceivedAt ? (
                        <span className="inline-flex flex-col">
                          <span className="w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Received
                          </span>
                          <span className="mt-0.5 text-xs text-slate-500">{r.withholdingReceiptNumber}</span>
                        </span>
                      ) : (
                        <span className="w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                    {hasPermission('finance.manage') && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() =>
                            setReceiptForm({ row: r, receiptNumber: r.withholdingReceiptNumber || '' })
                          }
                          className="text-xs font-medium text-slate-900 underline underline-offset-2"
                        >
                          {r.withholdingReceivedAt ? 'Edit' : 'Mark received'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              {!loading && withholding && withholding.rows.length > 0 && (
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={4} className="px-4 py-2.5 text-slate-900">
                    Total ({withholding.totals.count} sale(s))
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(withholding.totals.subtotal)}</td>
                  <td />
                  <td className="px-4 py-2.5 text-right tabular-nums">−{money(withholding.totals.withholdingAmount)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(withholding.totals.total)}</td>
                  <td className="px-4 py-2.5 text-slate-600" colSpan={hasPermission('finance.manage') ? 2 : 1}>
                    {withholding.totals.receivedCount} / {withholding.totals.count} received
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={receiptForm !== null}
        onClose={() => setReceiptForm(null)}
        title="Withholding Receipt"
        subtitle={receiptForm ? `${receiptForm.row.dspNumber} — ${receiptForm.row.customer}` : undefined}
        width="md"
      >
        {receiptForm && (
          <form onSubmit={submitReceipt} className="space-y-4" noValidate>
            <div>
              <label className={label}>Receipt / certificate number</label>
              <input
                value={receiptForm.receiptNumber}
                placeholder="e.g. WHT-00123"
                onChange={(e) => setReceiptForm({ ...receiptForm, receiptNumber: e.target.value })}
                className={`mt-1 w-full ${input}`}
              />
              <p className="mt-1 text-xs text-slate-500">
                Leave blank and save to clear the receipt status back to pending.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setReceiptForm(null)} className={btnGhost}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
