'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TrendChart, RankBars } from '@/components/ui/charts';
import { useToast } from '@/components/ui/toast';

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

// ── Phase A4: period-scoped analytics ───────────────────────

type Period = '7d' | '30d' | '90d' | '12m';

const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
];

interface ProfitTotals {
  totalSales: number;
  cogs: number;
  gross: number;
  expenses: number;
  net: number;
}

interface ProductStat {
  product: { code: string; genericName: string; brandName: string | null; dispenseUnit: string | null };
  quantity: number;
  revenue: number;
  margin: number;
}

interface Analytics {
  period: Period;
  profit: {
    current: ProfitTotals;
    previous: ProfitTotals;
    trend: { gross: number; net: number };
  };
  topCustomers: {
    customer: { id: number; name: string; phone: string | null } | null;
    orderCount: number;
    totalSpent: number;
    lastOrderAt: string;
  }[];
  charts: {
    salesVsPurchases: { label: string; sales: number; purchases: number }[];
    profitTrend: { label: string; gross: number; net: number }[];
    topProductsByMargin: ProductStat[];
    topProductsByVolume: ProductStat[];
    monthlyOverview: { label: string; sales: number; purchases: number }[];
  };
}

function formatAxisLabel(label: string) {
  if (label.length === 7) {
    return new Date(`${label}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  return new Date(`${label}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function TrendBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        up ? 'text-emerald-700' : 'text-red-600'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
        <path strokeLinecap="round" strokeLinejoin="round" d={up ? 'M12 19V5m0 0l-5 5m5-5l5 5' : 'M12 5v14m0 0l-5-5m5 5l5-5'} />
      </svg>
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

const CHART_BLUE = '#2a78d6';
const CHART_GREEN = '#008300';

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [period, setPeriod] = useState<Period>('30d');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    api<Overview>('/api/dashboard')
      .then(setData)
      .catch((e) => toast.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setAnalyticsLoading(true);
    api<Analytics>(`/api/dashboard/analytics?period=${period}`)
      .then(setAnalytics)
      .catch((e) => toast.error(e.message))
      .finally(() => setAnalyticsLoading(false));
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

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
              <div className="overflow-x-auto">
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
            </div>

            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Recent Sales</h2>
              </div>
              <div className="overflow-x-auto">
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
          </div>
        </>
      )}

      {/* ── Phase A4: period-scoped analytics ─────────────────── */}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Performance Overview</h2>
        <div className="flex rounded-md border border-slate-300 bg-white p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                period === p.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {analyticsLoading && !analytics && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
          ))}
        </div>
      )}

      {analytics && (
        <div className={analyticsLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Sales</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(analytics.profit.current.totalSales)}</p>
              <p className="text-[11px] text-slate-400">COGS {money(analytics.profit.current.cogs)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gross Profit</p>
                <TrendBadge pct={analytics.profit.trend.gross} />
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(analytics.profit.current.gross)}</p>
              <p className="text-[11px] text-slate-400">vs {money(analytics.profit.previous.gross)} previous period</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Expenses</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(analytics.profit.current.expenses)}</p>
              <p className="text-[11px] text-slate-400">non-sale purchases</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Net Profit / Loss</p>
                <TrendBadge pct={analytics.profit.trend.net} />
              </div>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${analytics.profit.current.net < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {money(analytics.profit.current.net)}
              </p>
              <p className="text-[11px] text-slate-400">vs {money(analytics.profit.previous.net)} previous period</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">Sales vs Purchases</h3>
              <div className="mt-3">
                <TrendChart
                  data={analytics.charts.salesVsPurchases}
                  series={[
                    { key: 'sales', label: 'Sales', color: CHART_BLUE },
                    { key: 'purchases', label: 'Purchases', color: CHART_GREEN },
                  ]}
                  formatValue={money}
                  formatAxisLabel={formatAxisLabel}
                />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">Gross &amp; Net Profit Trend</h3>
              <div className="mt-3">
                <TrendChart
                  data={analytics.charts.profitTrend}
                  series={[
                    { key: 'gross', label: 'Gross Profit', color: CHART_BLUE },
                    { key: 'net', label: 'Net Profit', color: CHART_GREEN },
                  ]}
                  formatValue={money}
                  formatAxisLabel={formatAxisLabel}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">Top Products by Margin</h3>
              <div className="mt-3">
                <RankBars
                  rows={analytics.charts.topProductsByMargin.map((p) => ({
                    label: p.product.genericName,
                    sublabel: p.product.code,
                    value: p.margin,
                  }))}
                  color={CHART_BLUE}
                  formatValue={money}
                />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">Top Products by Volume</h3>
              <div className="mt-3">
                <RankBars
                  rows={analytics.charts.topProductsByVolume.map((p) => ({
                    label: p.product.genericName,
                    sublabel: `${p.quantity} ${p.product.dispenseUnit || 'unit(s)'}`,
                    value: p.quantity,
                  }))}
                  color={CHART_GREEN}
                  formatValue={(v) => v.toLocaleString()}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">Monthly Performance Overview (last 12 months)</h3>
            <div className="mt-3">
              <TrendChart
                data={analytics.charts.monthlyOverview}
                series={[
                  { key: 'sales', label: 'Sales', color: CHART_BLUE },
                  { key: 'purchases', label: 'Purchases', color: CHART_GREEN },
                ]}
                formatValue={money}
                formatAxisLabel={formatAxisLabel}
                height={200}
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Top Customers</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">#</th>
                    <th className="px-2 py-2.5">Customer</th>
                    <th className="px-2 py-2.5 text-right">Orders</th>
                    <th className="px-2 py-2.5 text-right">Total Spent</th>
                    <th className="px-5 py-2.5 text-right">Last Order</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topCustomers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                        No customers captured yet — pick a customer when dispensing to see rankings here.
                      </td>
                    </tr>
                  )}
                  {analytics.topCustomers.map((c, i) => (
                    <tr key={c.customer?.id ?? i} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-2.5 text-slate-400">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <span className="font-medium text-slate-900">{c.customer?.name || 'Unknown'}</span>
                        {c.customer?.phone && <span className="ml-1 text-xs text-slate-400">{c.customer.phone}</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{c.orderCount}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-medium text-slate-900">{money(c.totalSpent)}</td>
                      <td className="px-5 py-2.5 text-right text-xs text-slate-400">
                        {new Date(c.lastOrderAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
