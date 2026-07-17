'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Drawer } from '@/components/ui/drawer';
import { SearchInput } from '@/components/ui/search-input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows, Spinner } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { Select } from '@/components/ui/select';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';
import { Tabs } from '@/components/ui/tabs';

interface Option {
  id: number;
  name: string;
}

interface Alert {
  type: 'EXPIRED' | 'EXPIRING' | 'LOW_STOCK' | 'OVER_STOCK' | 'ADJUSTMENT';
  product: { id: number; code: string; genericName: string; brandName: string | null; dispenseUnit: string | null };
  location: { id: number; name: string };
  batchId?: number;
  batchNo: string | null;
  expiryDate: string | null;
  daysToExpiry?: number;
  supplier: string | null;
  quantity: number;
  unit: string | null;
  severity?: number;
  detail: string;
  suggestedReorderQty?: number;
  recentDailyUsage?: number;
  movementType?: string;
  reason?: string | null;
  performedBy?: string;
  moveDate?: string;
}

const TYPE_META: Record<
  Alert['type'],
  { label: string; badge: string; ring: string; icon: React.ReactNode }
> = {
  EXPIRED: {
    label: 'Expired',
    badge: 'bg-red-50 text-red-700',
    ring: 'ring-red-200',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  EXPIRING: {
    label: 'Expiring',
    badge: 'bg-amber-50 text-amber-700',
    ring: 'ring-amber-200',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  LOW_STOCK: {
    label: 'Low Stock',
    badge: 'bg-red-50 text-red-700',
    ring: 'ring-red-200',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-6-6m6 6l6-6" />
      </svg>
    ),
  },
  OVER_STOCK: {
    label: 'Over Stock',
    badge: 'bg-amber-50 text-amber-700',
    ring: 'ring-amber-200',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4m0 0l-6 6m6-6l6 6" />
      </svg>
    ),
  },
  ADJUSTMENT: {
    label: 'Adjustments',
    badge: 'bg-slate-100 text-slate-700',
    ring: 'ring-slate-200',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="1.75" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.75" fill="currentColor" stroke="none" />
        <circle cx="9" cy="18" r="1.75" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
};

const MOVE_META: Record<string, { label: string; cls: string }> = {
  ADJUST_INCREASE: { label: 'Increased', cls: 'text-emerald-700' },
  ADJUST_DECREASE: { label: 'Decreased', cls: 'text-slate-600' },
  DISPOSE: { label: 'Disposed', cls: 'text-red-700' },
};

type Tab = 'ALL' | Alert['type'];

const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'EXPIRING', label: 'Expiring' },
  { key: 'LOW_STOCK', label: 'Low Stock' },
  { key: 'OVER_STOCK', label: 'Over Stock' },
  { key: 'ADJUSTMENT', label: 'Adjustments' },
];

// ── product details drawer ──────────────────────────────────

interface ProductDetail {
  product: {
    id: number;
    code: string;
    type: string;
    pharmClass: string;
    genericName: string;
    brandName: string | null;
    description: string | null;
    strength: string | null;
    doseUnit: string | null;
    route: string | null;
    doseForm: string | null;
    dispenseUnit: string | null;
    orderUnit: string | null;
    manufacturer: string | null;
    unitPrice: string;
    minStock: number | null;
    maxStock: number | null;
    expiryAlertDays: number | null;
    isActive: boolean;
    supplier: Option | null;
  };
  stocks: {
    id: number;
    quantity: number;
    batch: { batchNo: string; expiryDate: string | null; supplier: { name: string } | null };
    location: { id: number; name: string };
  }[];
  movements: {
    id: number;
    type: string;
    direction: 'IN' | 'OUT';
    quantity: number;
    reason: string | null;
    remark: string | null;
    createdAt: string;
    batch: { batchNo: string } | null;
    location: { name: string };
    performedBy: { fullName: string };
  }[];
  totalStock: number;
}

function ProductDetailDrawer({ productId, onClose }: { productId: number | null; onClose: () => void }) {
  const toast = useToast();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (productId == null) {
      setDetail(null);
      return;
    }
    setLoading(true);
    api<ProductDetail>(`/api/products/${productId}/detail`)
      .then(setDetail)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = detail?.product;

  return (
    <Drawer
      open={productId !== null}
      onClose={onClose}
      title={p ? p.genericName : 'Product Details'}
      subtitle={p ? `${p.code}${p.brandName ? ` · ${p.brandName}` : ''}` : undefined}
      width="lg"
    >
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {!loading && detail && p && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
            <p><span className="text-slate-500">Type:</span> <span className="text-slate-900">{p.type}</span></p>
            <p><span className="text-slate-500">Class:</span> <span className="text-slate-900">{p.pharmClass}</span></p>
            <p><span className="text-slate-500">Form / Route:</span> <span className="text-slate-900">{p.doseForm || '—'} {p.route ? `· ${p.route}` : ''}</span></p>
            <p><span className="text-slate-500">Strength:</span> <span className="text-slate-900">{p.strength ? `${p.strength} ${p.doseUnit || ''}`.trim() : '—'}</span></p>
            <p><span className="text-slate-500">Units:</span> <span className="text-slate-900">{p.orderUnit || '—'} → {p.dispenseUnit || '—'}</span></p>
            <p><span className="text-slate-500">Unit price:</span> <span className="tabular-nums text-slate-900">{Number(p.unitPrice).toFixed(2)}</span></p>
            <p><span className="text-slate-500">Manufacturer:</span> <span className="text-slate-900">{p.manufacturer || '—'}</span></p>
            <p><span className="text-slate-500">Supplier:</span> <span className="text-slate-900">{p.supplier?.name || '—'}</span></p>
            <p className="col-span-2">
              <span className="text-slate-500">Alert thresholds:</span>{' '}
              <span className="text-slate-900">
                min {p.minStock ?? '—'} · max {p.maxStock ?? '—'} · expiry window {p.expiryAlertDays ?? 'default'} day(s)
              </span>
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Stock</h3>
              <span className="text-xs text-slate-500">
                Total: <span className="font-semibold tabular-nums text-slate-900">{detail.totalStock}</span> {p.dispenseUnit || ''}
              </span>
            </div>
            <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Batch</th>
                    <th className="px-3 py-2">Expiry</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.stocks.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">No stock on hand.</td></tr>
                  )}
                  {detail.stocks.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-900">{s.location.name}</td>
                      <td className="px-3 py-2 text-slate-600">{s.batch.batchNo}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {s.batch.expiryDate ? new Date(s.batch.expiryDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">{s.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Movements</h3>
            <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2 text-right">In</th>
                    <th className="px-3 py-2 text-right">Out</th>
                    <th className="px-3 py-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.movements.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No movements yet.</td></tr>
                  )}
                  {detail.movements.map((m) => (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-slate-900">{MOVE_META[m.type]?.label || m.type}</td>
                      <td className="px-3 py-2 text-slate-600">{m.location.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">{m.direction === 'IN' ? m.quantity : ''}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">{m.direction === 'OUT' ? m.quantity : ''}</td>
                      <td className="px-3 py-2 text-slate-500">{m.performedBy.fullName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ── main page ────────────────────────────────────────────────

export default function AlertsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>('ALL');
  const [q, setQ] = useState('');
  const [locations, setLocations] = useState<Option[]>([]);
  const [locationId, setLocationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailProductId, setDetailProductId] = useState<number | null>(null);

  const [disposeTarget, setDisposeTarget] = useState<Alert | null>(null);
  const [disposeQty, setDisposeQty] = useState('');
  const [disposeReason, setDisposeReason] = useState('');
  const [disposeBusy, setDisposeBusy] = useState(false);

  const load = useCallback(async (loc: string, isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const params = new URLSearchParams();
      if (loc) params.set('locationId', loc);
      const d = await api<{ alerts: Alert[]; counts: Record<string, number> }>(`/api/alerts?${params}`);
      setAlerts(d.alerts);
      setCounts(d.counts);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    api<{ locations: Option[] }>('/api/locations')
      .then((d) => setLocations(d.locations))
      .catch((e) => toast.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load(locationId).catch((e) => toast.error(e.message));
  }, [locationId, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    let rows = tab === 'ALL' ? alerts : alerts.filter((a) => a.type === tab);
    if (q) {
      const term = q.toLowerCase();
      rows = rows.filter(
        (a) =>
          a.product.genericName.toLowerCase().includes(term) ||
          a.product.brandName?.toLowerCase().includes(term) ||
          a.product.code.toLowerCase().includes(term) ||
          a.batchNo?.toLowerCase().includes(term),
      );
    }
    return rows;
  }, [alerts, tab, q]);

  // Empty sortBy keeps the server's urgency-first ordering; clicking a column
  // overrides it with a plain client-side sort (JS sort is spec-stable).
  const { sortBy, sortDir, toggle } = useSort('');
  const sorted = useMemo(() => {
    if (!sortBy) return visible;
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (a: Alert): string | number => {
      switch (sortBy) {
        case 'type': return TYPE_META[a.type].label;
        case 'product': return a.product.genericName.toLowerCase();
        case 'location': return a.location.name.toLowerCase();
        case 'batch': return a.batchNo || '';
        case 'expiry': return a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
        case 'quantity': return a.quantity;
        default: return 0;
      }
    };
    return [...visible].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [visible, sortBy, sortDir]);

  function openDispose(a: Alert) {
    setDisposeTarget(a);
    setDisposeQty(String(a.quantity));
    setDisposeReason('');
  }

  async function confirmDispose() {
    if (!disposeTarget || disposeTarget.batchId == null) return;
    const qty = Number(disposeQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error('Enter a valid quantity to dispose');
      return;
    }
    if (qty > disposeTarget.quantity) {
      toast.error(`Only ${disposeTarget.quantity} ${disposeTarget.unit || 'unit(s)'} available`);
      return;
    }
    if (!disposeReason.trim()) {
      toast.error('A reason is required to dispose stock');
      return;
    }
    setDisposeBusy(true);
    try {
      await api('/api/inventory/dispose', {
        method: 'POST',
        body: JSON.stringify({
          batchId: disposeTarget.batchId,
          locationId: disposeTarget.location.id,
          quantity: qty,
          reason: disposeReason.trim(),
        }),
      });
      toast.success(`Disposed ${qty} ${disposeTarget.unit || 'unit(s)'} of ${disposeTarget.product.genericName}.`);
      setDisposeTarget(null);
      await load(locationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dispose failed');
    } finally {
      setDisposeBusy(false);
    }
  }

  const canDispose = hasPermission('inventory.adjust');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Expiry, stock-level and adjustment alerts — thresholds are set per product, in its own unit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => load(locationId, true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing ? <Spinner className="h-3.5 w-3.5" /> : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
            Refresh
          </button>
          <Select
            value={locationId}
            onChange={setLocationId}
            placeholder="All locations"
            options={[{ value: '', label: 'All locations' }, ...locations.map((l) => ({ value: String(l.id), label: l.name }))]}
            className="w-40 sm:w-48"
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TABS.filter((t) => t.key !== 'ALL').map((t) => {
          const key = t.key as Alert['type'];
          const meta = TYPE_META[key];
          const active = tab === key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(active ? 'ALL' : key)}
              className={`rounded-lg border bg-white p-3 text-left transition ${
                active ? `border-slate-900 ring-1 ${meta.ring}` : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}>
                {meta.icon}
                {meta.label}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{counts[key] || 0}</p>
            </button>
          );
        })}
      </div>

      <Tabs
        className="mt-5"
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        tabs={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: t.key === 'ALL' ? alerts.length : counts[t.key] || 0,
        }))}
      />

      <div className="mt-4">
        <SearchInput onSearch={setQ} placeholder="Search product or batch…" className="w-full sm:w-64" />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortableHeader label="Type" sortKey="type" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Product" sortKey="product" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Location" sortKey="location" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Batch" sortKey="batch" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Expiry" sortKey="expiry" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <SortableHeader label="Qty" sortKey="quantity" sortBy={sortBy} sortDir={sortDir} onSort={toggle} align="right" />
              <th className="px-4 py-3">Detail</th>
              <th className="px-4 py-3">By / Date</th>
              {canDispose && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={6} cols={canDispose ? 9 : 8} />}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title={q ? 'No alerts match your search' : tab === 'ALL' ? 'No alerts' : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} alerts`}
                    description={
                      q
                        ? 'Try a different product name, code or batch number.'
                        : 'Stock levels and expiry dates all look fine right now.'
                    }
                  />
                </td>
              </tr>
            )}
            {!loading &&
              sorted.map((a, i) => {
                const meta = TYPE_META[a.type];
                const showDispose =
                  canDispose && (a.type === 'EXPIRED' || a.type === 'EXPIRING') && a.batchId != null;
                return (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailProductId(a.product.id)}
                        className="text-left font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {a.product.genericName}
                      </button>
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
                    <td className="px-4 py-3 text-slate-600">
                      {a.detail}
                      {a.type === 'ADJUSTMENT' && a.movementType && (
                        <span className={`ml-2 text-xs font-medium ${MOVE_META[a.movementType]?.cls || ''}`}>
                          {MOVE_META[a.movementType]?.label}
                        </span>
                      )}
                      {a.type === 'LOW_STOCK' && !!a.suggestedReorderQty && (
                        <p className="mt-1 text-xs font-medium text-blue-700">
                          Suggested reorder: {a.suggestedReorderQty} {a.unit || 'unit(s)'}
                          {!!a.recentDailyUsage && (
                            <span className="font-normal text-slate-400"> · ~{a.recentDailyUsage}/day recent usage</span>
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {a.type === 'ADJUSTMENT'
                        ? `${a.performedBy} · ${a.moveDate ? new Date(a.moveDate).toLocaleDateString() : ''}`
                        : '—'}
                    </td>
                    {canDispose && (
                      <td className="px-4 py-3 text-right">
                        {showDispose && (
                          <button
                            onClick={() => openDispose(a)}
                            className="text-xs font-medium text-red-600 underline-offset-2 hover:underline"
                          >
                            Dispose
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <ProductDetailDrawer productId={detailProductId} onClose={() => setDetailProductId(null)} />

      <ConfirmDialog
        open={disposeTarget !== null}
        title="Dispose stock?"
        danger
        confirmLabel="Dispose"
        busy={disposeBusy}
        onConfirm={confirmDispose}
        onCancel={() => setDisposeTarget(null)}
        message={
          disposeTarget && (
            <div className="space-y-3">
              <p>
                <span className="font-medium text-slate-900">{disposeTarget.product.genericName}</span> — batch{' '}
                <span className="font-medium text-slate-900">{disposeTarget.batchNo}</span> at{' '}
                <span className="font-medium text-slate-900">{disposeTarget.location.name}</span>.
                {' '}This stock will be written off and removed from inventory permanently.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600">
                  Quantity to dispose ({disposeTarget.quantity} {disposeTarget.unit || 'unit(s)'} available)
                </label>
                <input
                  type="number"
                  min={1}
                  max={disposeTarget.quantity}
                  step={1}
                  value={disposeQty}
                  onChange={(e) => setDisposeQty(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600">Reason *</label>
                <textarea
                  required
                  rows={2}
                  value={disposeReason}
                  onChange={(e) => setDisposeReason(e.target.value)}
                  placeholder="e.g. Expired stock, damaged in storage…"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>
          )
        }
      />
    </div>
  );
}
