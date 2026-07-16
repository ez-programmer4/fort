'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { DateRangePicker } from '@/components/ui/date-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';

const input =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';

interface Option {
  id: number;
  name: string;
}

interface Movement {
  id: number;
  type: string;
  direction: 'IN' | 'OUT';
  quantity: number;
  reason: string | null;
  remark: string | null;
  createdAt: string;
  product: { code: string; genericName: string; dispenseUnit: string | null };
  batch: { batchNo: string; expiryDate: string | null } | null;
  location: { name: string };
  performedBy: { fullName: string };
}

const TYPE_LABELS: Record<string, string> = {
  GRV: 'Goods received',
  DISPENSE: 'Dispensed',
  ADJUST_INCREASE: 'Adjustment +',
  ADJUST_DECREASE: 'Adjustment −',
};

export default function AuditPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [locations, setLocations] = useState<Option[]>([]);
  const [locationId, setLocationId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (query: string, t: string, loc: string, f: string, dt: string, pageNum: number, size: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size) });
        if (query) params.set('q', query);
        if (t) params.set('type', t);
        if (loc) params.set('locationId', loc);
        if (f) params.set('from', f);
        if (dt) params.set('to', dt);
        const d = await api<{ movements: Movement[]; total: number }>(`/api/inventory/movements?${params}`);
        setRows(d.movements);
        setTotal(d.total);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    api<{ locations: Option[] }>('/api/locations')
      .then((d) => setLocations(d.locations))
      .catch((e) => toast.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load(q, type, locationId, from, to, page, pageSize).catch((e) => toast.error(e.message));
  }, [q, type, locationId, from, to, page, pageSize, load]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every stock movement in the system — receiving, dispensing and adjustments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            onSearch={(term) => {
              setQ(term);
              setPage(1);
            }}
            placeholder="Search product…"
            className="w-56"
          />
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={input}>
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={locationId} onChange={(e) => { setLocationId(e.target.value); setPage(1); }} className={input}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <DateRangePicker
            from={from}
            to={to}
            onChange={(r) => {
              setFrom(r.from);
              setTo(r.to);
              setPage(1);
            }}
            placeholder="All time"
          />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date & Time</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">In</th>
              <th className="px-4 py-3 text-right">Out</th>
              <th className="px-4 py-3">Reason / Remark</th>
              <th className="px-4 py-3">By</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={8} cols={9} />}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title={q || type || locationId || from || to ? 'No movements match your filters' : 'No movements yet'}
                    description="Stock movements from receiving, dispensing and adjustments will appear here."
                  />
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-500">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.direction === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {TYPE_LABELS[m.type] || m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{m.product.genericName}</span>
                    <span className="ml-1 font-mono text-xs text-slate-400">{m.product.code}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.batch?.batchNo || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{m.location.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                    {m.direction === 'IN' ? m.quantity : ''}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                    {m.direction === 'OUT' ? m.quantity : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.reason || m.remark || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{m.performedBy.fullName}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
