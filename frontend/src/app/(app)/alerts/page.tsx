'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const input =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';

interface Option {
  id: number;
  name: string;
}

interface Alert {
  type: 'EXPIRED' | 'EXPIRING' | 'LOW_STOCK' | 'OVER_STOCK' | 'ADJUSTMENT';
  product: { code: string; genericName: string; brandName: string | null; dispenseUnit: string | null };
  location: { id: number; name: string };
  batchNo: string | null;
  expiryDate: string | null;
  supplier: string | null;
  quantity: number;
  unit: string | null;
  detail: string;
  movementType?: string;
  reason?: string | null;
  performedBy?: string;
  moveDate?: string;
}

const TYPE_META: Record<Alert['type'], { label: string; cls: string }> = {
  EXPIRING: { label: 'Expiring', cls: 'bg-amber-50 text-amber-700' },
  EXPIRED: { label: 'Expired', cls: 'bg-red-50 text-red-700' },
  LOW_STOCK: { label: 'Low Stock', cls: 'bg-red-50 text-red-700' },
  OVER_STOCK: { label: 'Over Stock', cls: 'bg-amber-50 text-amber-700' },
  ADJUSTMENT: { label: 'Adjustments', cls: 'bg-slate-100 text-slate-700' },
};

type Tab = 'ALL' | Alert['type'];

const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'EXPIRING', label: 'Expiring' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'LOW_STOCK', label: 'Low Stock' },
  { key: 'OVER_STOCK', label: 'Over Stock' },
  { key: 'ADJUSTMENT', label: 'Adjustments' },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>('ALL');
  const [locations, setLocations] = useState<Option[]>([]);
  const [locationId, setLocationId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (loc: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (loc) params.set('locationId', loc);
    const d = await api<{ alerts: Alert[]; counts: Record<string, number> }>(`/api/alerts?${params}`);
    setAlerts(d.alerts);
    setCounts(d.counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    api<{ locations: Option[] }>('/api/locations')
      .then((d) => setLocations(d.locations))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load(locationId).catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [locationId, load]);

  const visible = tab === 'ALL' ? alerts : alerts.filter((a) => a.type === tab);
  const totalAll = alerts.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Expiry, stock-level and adjustment alerts — thresholds are set per product, in its own unit.
          </p>
        </div>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={input}>
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const count = t.key === 'ALL' ? totalAll : counts[t.key] || 0;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
                tab === t.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  tab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">Detail</th>
              <th className="px-4 py-3">By / Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  {tab === 'ALL'
                    ? 'No alerts — stock levels and expiry dates all look fine.'
                    : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} alerts.`}
                </td>
              </tr>
            )}
            {!loading &&
              visible.map((a, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_META[a.type].cls}`}>
                      {TYPE_META[a.type].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{a.product.genericName}</span>
                    {a.product.brandName && <span className="text-slate-500"> ({a.product.brandName})</span>}
                    <span className="ml-1 font-mono text-xs text-slate-400">{a.product.code}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.location.name}</td>
                  <td className="px-4 py-3 text-slate-600">{a.batchNo || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.expiryDate ? new Date(a.expiryDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                    {a.quantity}
                    {a.unit && <span className="ml-1 text-xs font-normal text-slate-400">{a.unit}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.detail}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {a.type === 'ADJUSTMENT'
                      ? `${a.performedBy} · ${a.moveDate ? new Date(a.moveDate).toLocaleDateString() : ''}`
                      : '—'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
