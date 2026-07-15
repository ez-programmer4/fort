'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function money(v: number) {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Overview {
  stock: { products: number; unitsInStock: number; stockValue: number; batchLocations: number };
  sales: { todayTotal: number; todayCount: number; last7dTotal: number; last7dCount: number };
  alertCounts: Record<string, number>;
  topMovers: { product: { code: string; genericName: string; dispenseUnit: string | null } | undefined; quantity: number }[];
  recentSales: { id: number; dspNumber: string; total: number; paymentType: string; location: string; createdAt: string }[];
}

const ALERT_LABELS: Record<string, string> = {
  EXPIRED: 'Expired',
  EXPIRING: 'Expiring soon',
  LOW_STOCK: 'Low stock',
  OVER_STOCK: 'Over stock',
};

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Overview>('/api/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const alertTotal = data
    ? Object.entries(data.alertCounts)
        .filter(([k]) => k !== 'ADJUSTMENT')
        .reduce((s, [, v]) => s + v, 0)
    : 0;

  const quickLinks = [
    { href: '/procurement', label: 'Purchase Orders', permission: 'procurement.view' },
    { href: '/sales', label: 'Dispense', permission: 'sales.dispense' },
    { href: '/inventory', label: 'Inventory', permission: 'inventory.view' },
    { href: '/reports', label: 'Reports', permission: 'reports.view' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Welcome back, {user?.fullName}.</p>
        </div>
        <div className="flex gap-2">
          {quickLinks
            .filter((q) => hasPermission(q.permission))
            .map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {q.label} →
              </Link>
            ))}
        </div>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Stock Value</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(data.stock.stockValue)}</p>
              <p className="text-[11px] text-slate-400">
                {data.stock.unitsInStock.toLocaleString()} unit(s) across {data.stock.batchLocations} batch-location(s)
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Products</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{data.stock.products}</p>
              <p className="text-[11px] text-slate-400">active in catalogue</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sales Today</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(data.sales.todayTotal)}</p>
              <p className="text-[11px] text-slate-400">{data.sales.todayCount} sale(s) today · {money(data.sales.last7dTotal)} last 7 days</p>
            </div>
            <Link
              href="/alerts"
              className={`rounded-lg border bg-white p-4 hover:border-slate-400 ${
                alertTotal > 0 ? 'border-slate-900' : 'border-slate-200'
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Active Alerts</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{alertTotal}</p>
              <p className="text-[11px] text-slate-400">
                {Object.entries(data.alertCounts)
                  .filter(([k]) => k !== 'ADJUSTMENT')
                  .map(([k, v]) => `${v} ${ALERT_LABELS[k] || k}`)
                  .join(' · ') || 'all clear'}
              </p>
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Top Moving Products (30 days)</h2>
              </div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {data.topMovers.length === 0 && (
                    <tr><td className="px-5 py-6 text-center text-slate-400">No dispensing activity yet.</td></tr>
                  )}
                  {data.topMovers.map((m, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-2.5 text-slate-400">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <span className="font-medium text-slate-900">{m.product?.genericName || '?'}</span>
                        <span className="ml-1 font-mono text-xs text-slate-400">{m.product?.code}</span>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-medium text-slate-900">
                        {m.quantity}
                        <span className="ml-1 text-xs font-normal text-slate-400">{m.product?.dispenseUnit || ''}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Recent Sales</h2>
              </div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {data.recentSales.length === 0 && (
                    <tr><td className="px-5 py-6 text-center text-slate-400">No sales yet.</td></tr>
                  )}
                  {data.recentSales.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-900">{s.dspNumber}</td>
                      <td className="px-2 py-2.5 text-slate-600">{s.location}</td>
                      <td className="px-2 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.paymentType === 'CASH' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {s.paymentType === 'CASH' ? 'Cash' : 'Credit'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-medium text-slate-900">{money(s.total)}</td>
                      <td className="px-5 py-2.5 text-right text-xs text-slate-400">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
