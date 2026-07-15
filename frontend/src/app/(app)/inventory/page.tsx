'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, apiDownload } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface LocationOption {
  id: number;
  name: string;
}

interface InventoryRow {
  stockId: number;
  batchId: number;
  productId: number;
  code: string;
  genericName: string;
  brandName: string | null;
  description: string | null;
  dispenseUnit: string | null;
  unitPrice: string;
  quantity: number;
  supplier: string | null;
  batchNo: string;
  expiryDate: string | null;
  location: { id: number; name: string };
}

interface AdjustState {
  row: InventoryRow;
  type: 'INCREASE' | 'DECREASE';
  quantity: string;
  reason: string;
}

const PAGE_SIZE = 20;

function expiryBadge(expiry: string | null) {
  if (!expiry) return null;
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0)
    return <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">Expired</span>;
  if (days <= 90)
    return <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{days}d left</span>;
  return null;
}

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState('');
  const [adjust, setAdjust] = useState<AdjustState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (search: string, loc: string, pageNum: number) => {
    const params = new URLSearchParams({ page: String(pageNum), pageSize: String(PAGE_SIZE) });
    if (search) params.set('q', search);
    if (loc) params.set('locationId', loc);
    const data = await api<{ items: InventoryRow[]; total: number }>(`/api/inventory?${params}`);
    setRows(data.items);
    setTotal(data.total);
  }, []);

  useEffect(() => {
    api<{ locations: LocationOption[] }>('/api/locations')
      .then((d) => setLocations(d.locations))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => load(q, locationId, page).catch((e) => setError(e.message)),
      q ? 300 : 0,
    );
    return () => clearTimeout(t);
  }, [q, locationId, page, load]);

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjust) return;
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const result = await api<{ quantityAfter: number }>('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          batchId: adjust.row.batchId,
          locationId: adjust.row.location.id,
          type: adjust.type,
          quantity: Number(adjust.quantity),
          reason: adjust.reason,
        }),
      });
      setNotice(
        `Stock ${adjust.type === 'INCREASE' ? 'increased' : 'decreased'} — ${adjust.row.genericName} (batch ${adjust.row.batchNo}) is now ${result.quantityAfter}.`,
      );
      setAdjust(null);
      await load(q, locationId, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjustment failed');
    } finally {
      setSaving(false);
    }
  }

  function exportNow() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (locationId) params.set('locationId', locationId);
    apiDownload(`/api/inventory/export?${params}`, 'inventory.xlsx').catch((e) => setError(e.message));
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const input =
    'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Current stock on hand per batch and location.
          </p>
        </div>
        <button
          onClick={exportNow}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Export
        </button>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {notice}
        </p>
      )}

      {adjust && (
        <form onSubmit={submitAdjust} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Stock Adjustment — {adjust.row.genericName} · batch {adjust.row.batchNo} ·{' '}
            {adjust.row.location.name} (current: {adjust.row.quantity})
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-600">Type</label>
              <select
                value={adjust.type}
                onChange={(e) =>
                  setAdjust({ ...adjust, type: e.target.value as 'INCREASE' | 'DECREASE' })
                }
                className={`mt-1 w-full ${input}`}
              >
                <option value="INCREASE">Increase</option>
                <option value="DECREASE">Decrease</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Quantity *</label>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={adjust.quantity}
                onChange={(e) => setAdjust({ ...adjust, quantity: e.target.value })}
                className={`mt-1 w-full ${input}`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600">Reason *</label>
              <input
                required
                value={adjust.reason}
                onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
                placeholder="e.g. Damaged stock, physical count correction…"
                className={`mt-1 w-full ${input}`}
              />
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? 'Applying…' : 'Apply adjustment'}
            </button>
            <button
              type="button"
              onClick={() => setAdjust(null)}
              className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search code, name, brand, batch…"
          className={`w-72 ${input}`}
        />
        <select
          value={locationId}
          onChange={(e) => {
            setLocationId(e.target.value);
            setPage(1);
          }}
          className={input}
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Generic Name</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Unit Price</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Batch No.</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Location</th>
              {hasPermission('inventory.adjust') && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-slate-400">
                  No stock found — goods receiving (Phase 5) brings stock in.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.stockId} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.genericName}</td>
                <td className="px-4 py-3 text-slate-600">{row.brandName || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                  {row.quantity}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.dispenseUnit || '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                  {Number(row.unitPrice).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.supplier || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{row.batchNo}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '—'}
                  {expiryBadge(row.expiryDate)}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.location.name}</td>
                {hasPermission('inventory.adjust') && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        setAdjust({ row, type: 'INCREASE', quantity: '', reason: '' })
                      }
                      className="text-xs font-medium text-slate-900 underline underline-offset-2"
                    >
                      Adjust
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} item(s) — page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
