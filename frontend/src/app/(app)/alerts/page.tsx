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
  EXPIRED: { label: 'Expired', cls: 'bg-red-50 text-red-700' },
  EXPIRING: { label: 'Expiring Soon', cls: 'bg-amber-50 text-amber-700' },
  LOW_STOCK: { label: 'Low Stock', cls: 'bg-red-50 text-red-700' },
  OVER_STOCK: { label: 'Over Stock', cls: 'bg-amber-50 text-amber-700' },
  ADJUSTMENT: { label: 'Adjustment', cls: 'bg-slate-100 text-slate-700' },
};

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All alerts' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'EXPIRING', label: 'Expiring soon' },
  { value: 'LOW_STOCK', label: 'Low stock' },
  { value: 'OVER_STOCK', label: 'Over stock' },
  { value: 'ADJUSTMENT', label: 'Stock adjustments' },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [type, setType] = useState('');
  const [locations, setLocations] = useState<Option[]>([]);
  const [locationId, setLocationId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (t: string, loc: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (t) params.set('type', t);
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
    load(type, locationId).catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [type, locationId, load]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Expiry, stock-level and adjustment alerts — thresholds are set per product, in its own unit.
          </p>
        </div>
        <div className="flex gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={input}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {(Object.keys(TYPE_META) as Alert['type'][]).map((t) => (
          <button
            key={t}
            onClick={() => setType(type === t ? '' : t)}
            className={`rounded-lg border p-3 text-left ${
              type === t ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{TYPE_META[t].label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{counts[t] || 0}</p>
          </button>
        ))}
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
            {!loading && alerts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No alerts — stock levels and expiry dates all look fine.
                </td>
              </tr>
            )}
            {!loading &&
              alerts.map((a, i) => (
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
