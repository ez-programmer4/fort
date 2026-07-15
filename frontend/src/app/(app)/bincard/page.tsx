'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ProductOption {
  id: number;
  code: string;
  genericName: string;
  brandName: string | null;
}

interface LocationOption {
  id: number;
  name: string;
}

interface BinRow {
  date: string;
  batchNo: string;
  expiryDate: string | null;
  supplier: string;
  movementType: string;
  in: number;
  out: number;
  balance: number;
  performedBy: string;
  remark: string;
}

interface BinCard {
  product: {
    code: string;
    genericName: string;
    brandName: string | null;
    description: string | null;
    dispenseUnit: string | null;
  };
  location: { name: string };
  opening: number;
  closing: number;
  rows: BinRow[];
}

export default function BinCardPage() {
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState('');
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [card, setCard] = useState<BinCard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ locations: LocationOption[] }>('/api/locations')
      .then((d) => setLocations(d.locations))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ products: ProductOption[] }>(
        `/api/products?pageSize=20${productQuery ? `&q=${encodeURIComponent(productQuery)}` : ''}`,
      )
        .then((d) => setProductOptions(d.products))
        .catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [productQuery]);

  async function run() {
    if (!productId || !locationId) {
      setError('Select a product and a location first');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({ productId, locationId });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      setCard(await api<BinCard>(`/api/reports/bincard?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bin card');
      setCard(null);
    } finally {
      setLoading(false);
    }
  }

  const input =
    'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bin Card</h1>
          <p className="mt-1 text-sm text-slate-500">
            Stock movement ledger for one product at one location.
          </p>
        </div>
        {card && (
          <button
            onClick={() => window.print()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Print / Save as PDF
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5 print:hidden">
        <div>
          <label className="block text-xs font-medium text-slate-600">Search product</label>
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Type to search…"
            className={`mt-1 w-full ${input}`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Product</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={`mt-1 w-full ${input}`}
          >
            <option value="">Select…</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.genericName}
                {p.brandName ? ` (${p.brandName})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Store / Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className={`mt-1 w-full ${input}`}
          >
            <option value="">Select…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`mt-1 w-full ${input}`}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`mt-1 w-full ${input}`}
            />
          </div>
        </div>
        <div className="flex items-end">
          <button
            onClick={run}
            disabled={loading}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Generate'}
          </button>
        </div>
      </div>

      {card && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 print:border-0 print:p-0">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900">Bin Card</h2>
            <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm md:grid-cols-4">
              <p>
                <span className="text-slate-500">Product:</span>{' '}
                <span className="font-medium text-slate-900">{card.product.genericName}</span>
              </p>
              <p>
                <span className="text-slate-500">Code:</span>{' '}
                <span className="font-mono text-slate-900">{card.product.code}</span>
              </p>
              <p>
                <span className="text-slate-500">Location:</span>{' '}
                <span className="font-medium text-slate-900">{card.location.name}</span>
              </p>
              <p>
                <span className="text-slate-500">Unit:</span>{' '}
                <span className="text-slate-900">{card.product.dispenseUnit || '—'}</span>
              </p>
              {card.product.description && (
                <p className="col-span-2">
                  <span className="text-slate-500">Description:</span>{' '}
                  <span className="text-slate-900">{card.product.description}</span>
                </p>
              )}
              <p>
                <span className="text-slate-500">Opening balance:</span>{' '}
                <span className="tabular-nums text-slate-900">{card.opening}</span>
              </p>
              <p>
                <span className="text-slate-500">Closing balance:</span>{' '}
                <span className="font-semibold tabular-nums text-slate-900">{card.closing}</span>
              </p>
            </div>
          </div>

          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Batch</th>
                <th className="py-2 pr-3">Expiry</th>
                <th className="py-2 pr-3">Supplier</th>
                <th className="py-2 pr-3 text-right">In</th>
                <th className="py-2 pr-3 text-right">Out</th>
                <th className="py-2 pr-3 text-right">Balance</th>
                <th className="py-2 pr-3">Performed By</th>
                <th className="py-2">Remark</th>
              </tr>
            </thead>
            <tbody>
              {card.rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-sm text-slate-400">
                    No stock movements for this product/location in the selected period.
                  </td>
                </tr>
              )}
              {card.rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 text-slate-600">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-3 text-slate-900">{r.batchNo}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{r.supplier}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-900">
                    {r.in || ''}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-900">
                    {r.out || ''}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums text-slate-900">
                    {r.balance}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{r.performedBy}</td>
                  <td className="py-2 text-slate-600">{r.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
