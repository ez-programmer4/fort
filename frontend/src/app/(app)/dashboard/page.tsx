'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TrendChart, RankBars } from '@/components/ui/charts';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

interface LocationOption {
  id: number;
  name: string;
}

function money(v: number) {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface MoverProduct {
  code: string;
  genericName: string;
  brandName?: string | null;
  dispenseUnit: string | null;
}

interface AlertInsight {
  type: 'LOW_STOCK' | 'EXPIRING' | 'EXPIRED' | 'OVER_STOCK';
  product: MoverProduct;
  location: { id: number; name: string };
  quantity: number;
  unit: string | null;
  severity?: number;
  suggestedReorderQty?: number;
  daysToExpiry?: number;
  detail: string;
}

interface Overview {
  stock: { products: number; unitsInStock: number; stockValue: number; batchLocations: number };
  sales: {
    todayTotal: number;
    todayCount: number;
    last7dTotal: number;
    last7dCount: number;
    last30dTotal: number;
    last30dCount: number;
    last30dTrend: number;
  };
  unpaidInvoices: { count: number; totalOutstanding: number };
  totalBuyers: number;
  alertCounts: Record<string, number>;
  alertInsights: { lowStock: AlertInsight[]; expiring: AlertInsight[]; overStock: AlertInsight[] };
  topMovers: { product: MoverProduct | undefined; quantity: number }[];
  slowMovers: { product: MoverProduct & { id: number }; quantity: number; value: number; soldQty30d: number }[];
  recentSales: { id: number; dspNumber: string; total: number; paymentType: string; location: string; createdAt: string }[];
}

const ALERT_LABELS: Record<string, string> = {
  EXPIRED: 'Expired',
  EXPIRING: 'Expiring soon',
  LOW_STOCK: 'Low stock',
  OVER_STOCK: 'Over stock',
};

const INSIGHT_BADGE: Record<AlertInsight['type'], string> = {
  EXPIRED: 'bg-red-50 text-red-700',
  EXPIRING: 'bg-amber-50 text-amber-700',
  LOW_STOCK: 'bg-red-50 text-red-700',
  OVER_STOCK: 'bg-amber-50 text-amber-700',
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
  paymentMix: { cashTotal: number; cashCount: number; creditTotal: number; creditCount: number };
  locationPerformance: { location: { id: number; name: string }; revenue: number; orders: number }[];
  charts: {
    salesOverview: { label: string; revenue: number; orders: number }[];
    salesVsPurchases: { label: string; sales: number; purchases: number }[];
    profitTrend: { label: string; gross: number; net: number }[];
    topProductsByMargin: ProductStat[];
    topProductsByVolume: ProductStat[];
    topProductsByRevenue: ProductStat[];
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
const CHART_SLATE = '#475569';
const CHART_AMBER = '#b45309';

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [period, setPeriod] = useState<Period>('30d');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    api<{ locations: LocationOption[] }>('/api/locations')
      .then((d) => setLocations(d.locations))
      .catch(() => {});
  }, []);

  const loadOverview = useCallback(() => {
    const q = locationId ? `?locationId=${locationId}` : '';
    return api<Overview>(`/api/dashboard${q}`)
      .then((d) => {
        setData(d);
        setLastUpdated(new Date());
      })
      .catch((e) => toast.error(e.message));
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAnalytics = useCallback(() => {
    setAnalyticsLoading(true);
    const q = new URLSearchParams({ period });
    if (locationId) q.set('locationId', locationId);
    return api<Analytics>(`/api/dashboard/analytics?${q}`)
      .then((d) => {
        setAnalytics(d);
        setLastUpdated(new Date());
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setAnalyticsLoading(false));
  }, [period, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  function refresh() {
    loadOverview();
    loadAnalytics();
  }

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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-48">
          <Select
            value={locationId}
            onChange={setLocationId}
            placeholder="All locations"
            options={[{ value: '', label: 'All locations' }, ...locations.map((l) => ({ value: String(l.id), label: l.name }))]}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh dashboard"
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Inventory</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(data.stock.stockValue)}</p>
              <p className="text-[11px] text-slate-400">
                {data.stock.unitsInStock.toLocaleString()} unit(s) · {data.stock.products} product(s)
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Monthly Sales</p>
                <TrendBadge pct={data.sales.last30dTrend} />
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(data.sales.last30dTotal)}</p>
              <p className="text-[11px] text-slate-400">
                {data.sales.last30dCount} sale(s) · {money(data.sales.todayTotal)} today
              </p>
            </div>
            <Link
              href="/wallet"
              className={`rounded-lg border bg-white p-4 hover:border-slate-400 ${
                data.unpaidInvoices.count > 0 ? 'border-amber-300' : 'border-slate-200'
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Unpaid Invoices</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{data.unpaidInvoices.count}</p>
              <p className="text-[11px] text-slate-400">{money(data.unpaidInvoices.totalOutstanding)} outstanding</p>
            </Link>
            <Link
              href="/alerts"
              className={`rounded-lg border bg-white p-4 hover:border-slate-400 ${
                (data.alertCounts.LOW_STOCK || 0) > 0 ? 'border-red-300' : 'border-slate-200'
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Low Stock</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{data.alertCounts.LOW_STOCK || 0}</p>
              <p className="text-[11px] text-slate-400">product(s) below minimum</p>
            </Link>
            <Link
              href="/alerts"
              className={`rounded-lg border bg-white p-4 hover:border-slate-400 ${
                (data.alertCounts.EXPIRED || 0) + (data.alertCounts.EXPIRING || 0) > 0 ? 'border-amber-300' : 'border-slate-200'
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Expiring</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {(data.alertCounts.EXPIRED || 0) + (data.alertCounts.EXPIRING || 0)}
              </p>
              <p className="text-[11px] text-slate-400">
                {data.alertCounts.EXPIRED || 0} expired · {data.alertCounts.EXPIRING || 0} expiring soon
              </p>
            </Link>
            <Link
              href="/customers"
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Buyers</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{data.totalBuyers}</p>
              <p className="text-[11px] text-slate-400">customer(s) with orders</p>
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Alerts &amp; Insights</h2>
                <Link href="/alerts" className="text-xs font-medium text-slate-500 hover:text-slate-900">
                  View all →
                </Link>
              </div>
              <div className="divide-y divide-slate-100 px-5 py-2">
                {(['lowStock', 'expiring', 'overStock'] as const).map((key) => {
                  const items = data.alertInsights[key];
                  const typeLabel = key === 'lowStock' ? 'Low stock' : key === 'expiring' ? 'Expiring / expired' : 'Over stock';
                  return (
                    <div key={key} className="py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {typeLabel} <span className="text-slate-400">({items.length})</span>
                      </p>
                      {items.length === 0 ? (
                        <p className="mt-1.5 text-sm text-slate-400">All clear.</p>
                      ) : (
                        <ul className="mt-1.5 space-y-2">
                          {items.map((a, i) => (
                            <li key={i} className="text-sm">
                              <div>
                                <span className={`mr-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${INSIGHT_BADGE[a.type]}`}>
                                  {ALERT_LABELS[a.type]}
                                </span>
                                <span className="font-medium text-slate-900">{a.product.genericName}</span>
                                <span className="ml-1 text-xs text-slate-400">{a.location.name}</span>
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">{a.detail}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
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

          <div className="mt-6">
            <h3 className="text-base font-semibold text-slate-900">Sales Overview</h3>
            <p className="text-xs text-slate-500">Revenue and order volume for the selected period.</p>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-slate-900">Revenue</h4>
                <div className="mt-3">
                  <TrendChart
                    data={analytics.charts.salesOverview}
                    series={[{ key: 'revenue', label: 'Revenue', color: CHART_BLUE }]}
                    formatValue={money}
                    formatAxisLabel={formatAxisLabel}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-slate-900">Order Volume</h4>
                <div className="mt-3">
                  <TrendChart
                    data={analytics.charts.salesOverview}
                    series={[{ key: 'orders', label: 'Orders', color: CHART_SLATE }]}
                    formatValue={(v) => v.toLocaleString()}
                    formatAxisLabel={formatAxisLabel}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">Payment Mix</h3>
              <p className="text-xs text-slate-500">Cash vs. credit sales for the selected period.</p>
              {(() => {
                const { cashTotal, cashCount, creditTotal, creditCount } = analytics.paymentMix;
                const total = cashTotal + creditTotal;
                const cashPct = total > 0 ? (cashTotal / total) * 100 : 50;
                return total === 0 ? (
                  <div className="mt-3 flex min-h-20 items-center justify-center text-sm text-slate-400">
                    No sales in this period.
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full" style={{ width: `${cashPct}%`, backgroundColor: CHART_BLUE }} />
                      <div className="h-full" style={{ width: `${100 - cashPct}%`, backgroundColor: CHART_AMBER }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_BLUE }} />
                        <span className="font-medium text-slate-900">Cash</span>
                        <span className="text-xs text-slate-400">({cashCount})</span>
                      </span>
                      <span className="tabular-nums font-semibold text-slate-900">{money(cashTotal)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_AMBER }} />
                        <span className="font-medium text-slate-900">Credit</span>
                        <span className="text-xs text-slate-400">({creditCount})</span>
                      </span>
                      <span className="tabular-nums font-semibold text-slate-900">{money(creditTotal)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            {analytics.locationPerformance.length > 1 && (
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900">Location Performance</h3>
                <p className="text-xs text-slate-500">Revenue by location for the selected period.</p>
                <div className="mt-3">
                  <RankBars
                    rows={analytics.locationPerformance.map((l) => ({
                      label: l.location.name,
                      sublabel: `${l.orders} order(s)`,
                      value: l.revenue,
                    }))}
                    color={CHART_GREEN}
                    formatValue={money}
                  />
                </div>
              </div>
            )}
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

          <div className="mt-6">
            <h3 className="text-base font-semibold text-slate-900">Top Products</h3>
            <p className="text-xs text-slate-500">Fast movers by revenue, margin, and volume for the selected period.</p>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-slate-900">By Revenue</h4>
                <div className="mt-3">
                  <RankBars
                    rows={analytics.charts.topProductsByRevenue.map((p) => ({
                      label: p.product.genericName,
                      sublabel: p.product.code,
                      value: p.revenue,
                    }))}
                    color={CHART_BLUE}
                    formatValue={money}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-slate-900">By Margin</h4>
                <div className="mt-3">
                  <RankBars
                    rows={analytics.charts.topProductsByMargin.map((p) => ({
                      label: p.product.genericName,
                      sublabel: p.product.code,
                      value: p.margin,
                    }))}
                    color={CHART_GREEN}
                    formatValue={money}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-slate-900">By Volume</h4>
                <div className="mt-3">
                  <RankBars
                    rows={analytics.charts.topProductsByVolume.map((p) => ({
                      label: p.product.genericName,
                      sublabel: `${p.quantity} ${p.product.dispenseUnit || 'unit(s)'}`,
                      value: p.quantity,
                    }))}
                    color={CHART_SLATE}
                    formatValue={(v) => v.toLocaleString()}
                  />
                </div>
              </div>
            </div>
          </div>

          {data && (
            <div className="mt-6">
              <h3 className="text-base font-semibold text-slate-900">Fast &amp; Slow Movers</h3>
              <p className="text-xs text-slate-500">Fixed 30-day window, independent of the period filter above.</p>
              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <h4 className="text-sm font-semibold text-slate-900">Fast Movers</h4>
                  <p className="text-xs text-slate-500">Top sellers in the last 30 days.</p>
                  <div className="mt-3">
                    <RankBars
                      rows={data.topMovers
                        .filter((m) => m.product)
                        .map((m) => ({
                          label: m.product!.genericName,
                          sublabel: `${m.product!.code} · ${m.quantity} ${m.product!.dispenseUnit || 'unit(s)'} sold`,
                          value: m.quantity,
                        }))}
                      color={CHART_GREEN}
                      formatValue={(v) => v.toLocaleString()}
                      emptyText="No dispensing activity in the last 30 days."
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <h4 className="text-sm font-semibold text-slate-900">Slow Movers</h4>
                  <p className="text-xs text-slate-500">Sitting in stock — push or discount.</p>
                  <div className="mt-3">
                    <RankBars
                      rows={data.slowMovers.map((m) => ({
                        label: m.product.genericName,
                        sublabel: `${m.product.code} · ${m.soldQty30d} sold in 30d`,
                        value: m.value,
                      }))}
                      color={CHART_AMBER}
                      formatValue={money}
                      emptyText="Nothing sitting idle — everything in stock has recent sales."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

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
