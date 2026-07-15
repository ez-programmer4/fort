'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, apiDownload } from '@/lib/api';

const input =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
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
  const [tab, setTab] = useState<'finance' | 'sales'>('finance');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [locations, setLocations] = useState<Option[]>([]);
  const [locationId, setLocationId] = useState('');
  const [finance, setFinance] = useState<Finance | null>(null);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [error, setError] = useState('');

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
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setError('');
    const q = params();
    if (tab === 'finance') {
      api<Finance>(`/api/reports/finance?${q}`).then(setFinance).catch((e) => setError(e.message));
    } else {
      api<SalesData>(`/api/reports/sales?${q}`).then(setSales).catch((e) => setError(e.message));
    }
  }, [tab, params]);

  function downloadPdf() {
    const path = tab === 'finance' ? '/api/reports/finance.pdf' : '/api/reports/sales.pdf';
    apiDownload(`${path}?${params()}`, `${tab}-report.pdf`).catch((e) => setError(e.message));
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

      <div className="mt-5 flex gap-1 border-b border-slate-200">
        {(['finance', 'sales'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t === 'finance' ? 'Finance Report' : 'Sales Report'}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className={label}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 ${input}`} />
        </div>
        <div>
          <label className={label}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 ${input}`} />
        </div>
        <div>
          <label className={label}>Location</label>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={`mt-1 ${input}`}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {tab === 'finance' && finance && (
        <div className="mt-4 max-w-xl rounded-lg border border-slate-200 bg-white p-6">
          {financeRows.map((r) => (
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

      {tab === 'sales' && sales && (
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
              {sales.days.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No sales in this period.</td></tr>
              )}
              {sales.days.map((d) => (
                <tr key={d.date} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 text-slate-900">{new Date(d.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{d.count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{money(d.gross)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{money(d.cash)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{money(d.credit)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{money(d.net)}</td>
                </tr>
              ))}
              {sales.days.length > 0 && (
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
