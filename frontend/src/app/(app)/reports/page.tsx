'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, apiDownload } from '@/lib/api';
import { DateRangePicker } from '@/components/ui/date-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';

const label = 'block text-xs font-medium text-slate-600';
const btnPrimary =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50';

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

export default function ReportsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'finance' | 'sales'>('finance');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [locations, setLocations] = useState<Option[]>([]);
  const [locationId, setLocationId] = useState('');
  const [finance, setFinance] = useState<Finance | null>(null);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);

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
    const req = tab === 'finance' ? api<Finance>(`/api/reports/finance?${q}`).then(setFinance) : api<SalesData>(`/api/reports/sales?${q}`).then(setSales);
    req.catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [tab, params]); // eslint-disable-line react-hooks/exhaustive-deps

  function downloadPdf() {
    const path = tab === 'finance' ? '/api/reports/finance.pdf' : '/api/reports/sales.pdf';
    apiDownload(`${path}?${params()}`, `${tab}-report.pdf`).catch((e) => toast.error(e.message));
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
        onChange={(v) => setTab(v as 'finance' | 'sales')}
        tabs={[
          { key: 'finance', label: 'Finance Report' },
          { key: 'sales', label: 'Sales Report' },
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
    </div>
  );
}
