'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { AppSettings, useSettings } from '@/lib/settings';
import { Drawer } from '@/components/ui/drawer';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Combobox, ComboOption } from '@/components/ui/combobox';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';

// ── shared bits ──────────────────────────────────────────────

const input =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';
const btnPrimary =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50';
const btnGhost =
  'rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50';

const WHT_OPTIONS = [
  { value: 'NONE', label: 'No withholding', defaultRate: 0 },
  { value: 'GOODS', label: 'Goods', defaultRate: 2 },
  { value: 'SERVICES', label: 'Services', defaultRate: 2 },
];

function whtRateFor(value: string, settings: AppSettings | null): number {
  if (value === 'GOODS') return settings?.whtGoodsRate ?? 2;
  if (value === 'SERVICES') return settings?.whtServicesRate ?? 2;
  return 0;
}

function money(v: string | number) {
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: 'bg-slate-100 text-slate-700',
    RECEIVED: 'bg-emerald-50 text-emerald-700',
    CANCELLED: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || ''}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

interface Option {
  id: number;
  name: string;
  isActive: boolean;
}

interface ProductOption {
  id: number;
  code: string;
  genericName: string;
  brandName: string | null;
  dispenseUnit: string | null;
  unitPrice: string;
  isActive?: boolean;
}

interface POItem {
  id: number;
  quantity: number;
  unitCost: string;
  batchNo: string | null;
  expiryDate: string | null;
  product: ProductOption;
}

interface PO {
  id: number;
  poNumber: string;
  status: string;
  notes: string | null;
  createdAt: string;
  supplier: Option | null;
  location: Option;
  createdBy: { fullName: string };
  items: POItem[];
  receipts: { grvNumber: string }[];
}

// ── new PO form (rendered inside a Drawer) ───────────────────

interface DraftLine {
  product: ProductOption;
  quantity: string;
  unitCost: string;
  batchNo: string;
  expiryDate: string;
}

function NewOrderForm({
  suppliers,
  locations,
  onDone,
  onCancel,
}: {
  suppliers: Option[];
  locations: Option[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [supplierId, setSupplierId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [pickedProductId, setPickedProductId] = useState('');
  const [saving, setSaving] = useState(false);

  const searchProducts = useCallback((term: string) => {
    api<{ products: ProductOption[] }>(
      `/api/products?pageSize=20&active=true${term ? `&q=${encodeURIComponent(term)}` : ''}`,
    )
      .then((d) => setProductOptions(d.products))
      .catch(() => {});
  }, []);

  useEffect(() => {
    searchProducts('');
  }, [searchProducts]);

  const productComboOptions: ComboOption[] = productOptions.map((p) => ({
    value: String(p.id),
    label: `${p.genericName}${p.brandName ? ` (${p.brandName})` : ''}`,
    sublabel: p.code,
  }));

  function addLine(id: string) {
    setPickedProductId(id);
    const product = productOptions.find((p) => p.id === Number(id));
    if (!product) return;
    if (lines.some((l) => l.product.id === product.id)) {
      setPickedProductId('');
      return;
    }
    setLines((prev) => [
      ...prev,
      { product, quantity: '1', unitCost: String(product.unitPrice), batchNo: '', expiryDate: '' },
    ]);
    setPickedProductId('');
  }

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
    [lines],
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) {
      toast.error('Select a receiving location');
      return;
    }
    if (lines.length === 0) {
      toast.error('Add at least one product line');
      return;
    }
    setSaving(true);
    try {
      await api('/api/procurement/orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: supplierId ? Number(supplierId) : null,
          locationId: Number(locationId),
          notes: notes || null,
          items: lines.map((l) => ({
            productId: l.product.id,
            quantity: Number(l.quantity),
            unitCost: Number(l.unitCost),
            batchNo: l.batchNo || null,
            expiryDate: l.expiryDate || null,
          })),
        }),
      });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Supplier</label>
          <Combobox
            options={suppliers.filter((s) => s.isActive).map((s) => ({ value: String(s.id), label: s.name }))}
            value={supplierId}
            onChange={setSupplierId}
            placeholder="Search supplier…"
            className="mt-1"
          />
        </div>
        <div>
          <label className={label}>Receiving location *</label>
          <Select
            value={locationId}
            onChange={setLocationId}
            placeholder="Select…"
            options={locations.filter((l) => l.isActive).map((l) => ({ value: String(l.id), label: l.name }))}
            className="mt-1"
          />
        </div>
        <div>
          <label className={label}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 w-full ${input}`} />
        </div>
      </div>

      <div className="mt-5 rounded-md border border-slate-200 p-3">
        <label className={label}>Add products</label>
        <Combobox
          options={productComboOptions}
          value={pickedProductId}
          onChange={addLine}
          onSearch={searchProducts}
          placeholder="Search product to add a line…"
          className="mt-2 max-w-md"
        />

        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Qty *</th>
                  <th className="py-2 pr-3">Unit Cost *</th>
                  <th className="py-2 pr-3">Batch No.</th>
                  <th className="py-2 pr-3">Expiry</th>
                  <th className="py-2 pr-3 text-right">Line Total</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.product.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-900">{l.product.genericName}</p>
                      <p className="text-xs text-slate-400">{l.product.code}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="1" step="1" required value={l.quantity}
                        onChange={(e) => setLine(i, { quantity: e.target.value })} className={`w-20 ${input}`} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="0.01" step="0.01" required value={l.unitCost}
                        onChange={(e) => setLine(i, { unitCost: e.target.value })} className={`w-28 ${input}`} />
                    </td>
                    <td className="py-2 pr-3">
                      <input value={l.batchNo} placeholder="(at receiving)"
                        onChange={(e) => setLine(i, { batchNo: e.target.value })} className={`w-32 ${input}`} />
                    </td>
                    <td className="py-2 pr-3">
                      <DatePicker
                        value={l.expiryDate}
                        onChange={(d) => setLine(i, { expiryDate: d })}
                        placeholder="(optional)"
                        className="w-36"
                      />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {money((Number(l.quantity) || 0) * (Number(l.unitCost) || 0))}
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                        className="text-xs text-slate-400 hover:text-red-600">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200">
                  <td colSpan={5} className="py-2 pr-3 text-right text-sm font-medium text-slate-600">Subtotal</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums text-slate-900">{money(subtotal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Saving…' : 'Create Purchase Order'}
        </button>
        <button type="button" onClick={onCancel} className={btnGhost}>Cancel</button>
      </div>
    </form>
  );
}

// ── receive form (rendered inside a Drawer) ──────────────────

interface ReceiveLine {
  itemId: number;
  product: ProductOption;
  quantity: string;
  unitCost: string;
  batchNo: string;
  expiryDate: string;
}

function ReceiveForm({ order, onDone, onCancel }: { order: PO; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const settings = useSettings();
  const [lines, setLines] = useState<ReceiveLine[]>(
    order.items.map((it) => ({
      itemId: it.id,
      product: it.product,
      quantity: String(it.quantity),
      unitCost: String(it.unitCost),
      batchNo: it.batchNo || '',
      expiryDate: it.expiryDate ? it.expiryDate.slice(0, 10) : '',
    })),
  );
  const [whtType, setWhtType] = useState('NONE');
  const [whtRate, setWhtRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function setLine(i: number, patch: Partial<ReceiveLine>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
    [lines],
  );
  const whtAmount = whtType === 'NONE' ? 0 : (subtotal * (Number(whtRate) || 0)) / 100;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (lines.some((l) => !l.batchNo.trim())) {
      toast.error('Every line needs a batch number');
      return;
    }
    setSaving(true);
    try {
      await api(`/api/procurement/orders/${order.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          withholdingType: whtType,
          withholdingRate: Number(whtRate) || 0,
          notes: notes || null,
          items: lines.map((l) => ({
            itemId: l.itemId,
            quantity: Number(l.quantity),
            unitCost: Number(l.unitCost),
            batchNo: l.batchNo.trim(),
            expiryDate: l.expiryDate || null,
          })),
        }),
      });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Receiving failed');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-3">Product</th>
              <th className="py-2 pr-3">Qty received *</th>
              <th className="py-2 pr-3">Unit Cost *</th>
              <th className="py-2 pr-3">Batch No. *</th>
              <th className="py-2 pr-3">Expiry Date</th>
              <th className="py-2 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.itemId} className="border-t border-slate-100">
                <td className="py-2 pr-3">
                  <p className="font-medium text-slate-900">{l.product.genericName}</p>
                  <p className="text-xs text-slate-400">{l.product.code}</p>
                </td>
                <td className="py-2 pr-3">
                  <input type="number" min="1" step="1" required value={l.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })} className={`w-24 ${input}`} />
                </td>
                <td className="py-2 pr-3">
                  <input type="number" min="0.01" step="0.01" required value={l.unitCost}
                    onChange={(e) => setLine(i, { unitCost: e.target.value })} className={`w-28 ${input}`} />
                </td>
                <td className="py-2 pr-3">
                  <input required value={l.batchNo}
                    onChange={(e) => setLine(i, { batchNo: e.target.value })} className={`w-32 ${input}`} />
                </td>
                <td className="py-2 pr-3">
                  <DatePicker
                    value={l.expiryDate}
                    onChange={(d) => setLine(i, { expiryDate: d })}
                    placeholder="(optional)"
                    className="w-36"
                  />
                </td>
                <td className="py-2 text-right tabular-nums">
                  {money((Number(l.quantity) || 0) * (Number(l.unitCost) || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-slate-200 pt-4">
        <div>
          <label className={label}>Withholding tax</label>
          <Select
            value={whtType}
            onChange={(v) => {
              const opt = WHT_OPTIONS.find((o) => o.value === v)!;
              setWhtType(opt.value);
              setWhtRate(String(whtRateFor(opt.value, settings)));
            }}
            options={WHT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            className="mt-1 w-44"
          />
        </div>
        {whtType !== 'NONE' && (
          <div>
            <label className={label}>Rate %</label>
            <input type="number" min="0" max="100" step="0.01" value={whtRate}
              onChange={(e) => setWhtRate(e.target.value)} className={`mt-1 w-24 ${input}`} />
          </div>
        )}
        <div className="flex-1">
          <label className={label}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 w-full ${input}`} />
        </div>
        <div className="text-right text-sm">
          <p className="text-slate-500">Subtotal: <span className="tabular-nums font-medium text-slate-900">{money(subtotal)}</span></p>
          <p className="text-slate-500">Withholding: <span className="tabular-nums font-medium text-slate-900">{whtAmount === 0 ? money(0) : `−${money(whtAmount)}`}</span></p>
          <p className="mt-1 font-semibold text-slate-900">Net payable: <span className="tabular-nums">{money(subtotal - whtAmount)}</span></p>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Receiving…' : 'Confirm Receiving (GRV)'}
        </button>
        <button type="button" onClick={onCancel} className={btnGhost}>Cancel</button>
      </div>
    </form>
  );
}

// ── main page ────────────────────────────────────────────────

type Tab = 'orders' | 'grv';

interface Receipt {
  id: number;
  grvNumber: string;
  subtotal: string;
  withholdingType: string;
  withholdingRate: string;
  withholdingAmount: string;
  netPayable: string;
  createdAt: string;
  purchaseOrder: { poNumber: string } | null;
  supplier: { name: string } | null;
  location: { name: string };
  receivedBy: { fullName: string };
  items: {
    id: number;
    quantity: number;
    unitCost: string;
    product: { code: string; genericName: string; dispenseUnit: string | null };
    batch: { batchNo: string; expiryDate: string | null };
  }[];
}

export default function ProcurementPage() {
  const toast = useToast();
  const settings = useSettings();
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<PO[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [receiving, setReceiving] = useState<PO | null>(null);
  const [expandedGrv, setExpandedGrv] = useState<number | null>(null);
  const [cancelPo, setCancelPo] = useState<PO | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // per-tab search + pagination
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const { sortBy, sortDir, toggle, reset: resetSort } = useSort('createdAt', 'desc');

  // expense form state
  const load = useCallback(async (which: Tab, search: string, pageNum: number, size: number, sBy: string, sDir: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size), sortBy: sBy, sortDir: sDir });
      if (search) params.set('q', search);
      if (which === 'orders') {
        const d = await api<{ orders: PO[]; total: number }>(`/api/procurement/orders?${params}`);
        setOrders(d.orders);
        setTotal(d.total);
      } else {
        const d = await api<{ receipts: Receipt[]; total: number }>(`/api/procurement/receipts?${params}`);
        setReceipts(d.receipts);
        setTotal(d.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api<{ suppliers: Option[] }>('/api/suppliers'),
      api<{ locations: Option[] }>('/api/locations'),
    ])
      .then(([s, l]) => {
        setSuppliers(s.suppliers);
        setLocations(l.locations);
      })
      .catch((e) => toast.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load(tab, q, page, pageSize, sortBy, sortDir).catch((e) => toast.error(e.message));
  }, [tab, q, page, pageSize, sortBy, sortDir, load]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchTab(t: Tab) {
    setTab(t);
    setQ('');
    setPage(1);
    setTotal(0);
    setShowNew(false);
    setReceiving(null);
    resetSort('createdAt', 'desc');
  }

  async function confirmCancelOrder() {
    if (!cancelPo) return;
    setCancelBusy(true);
    try {
      await api(`/api/procurement/orders/${cancelPo.id}/cancel`, { method: 'POST' });
      toast.success(`${cancelPo.poNumber} cancelled.`);
      setCancelPo(null);
      await load('orders', q, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cancel failed');
      setCancelPo(null);
    } finally {
      setCancelBusy(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'orders', label: 'Purchase Orders' },
    { key: 'grv', label: 'GRV History' },
  ];

  const searchPlaceholder = tab === 'orders' ? 'Search PO no. or supplier…' : 'Search GRV, PO or supplier…';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Procurement</h1>
          <p className="mt-1 text-sm text-slate-500">Purchase orders and goods receiving.</p>
        </div>
        {tab === 'orders' && (
          <button onClick={() => setShowNew(true)} className={btnPrimary}>+ New Purchase Order</button>
        )}
      </div>

      <Tabs
        className="mt-5"
        value={tab}
        onChange={(v) => switchTab(v as Tab)}
        tabs={tabs}
      />

      <div className="mt-4">
        <SearchInput
          key={tab}
          onSearch={(term) => {
            setQ(term);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
          className="w-72"
        />
      </div>

      {tab === 'orders' && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <SortableHeader label="PO No." sortKey="poNumber" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Supplier" sortKey="supplier" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Location" sortKey="location" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <SortableHeader label="Status" sortKey="status" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Created" sortKey="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={5} cols={8} />}
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title={q ? 'No purchase orders match your search' : 'No purchase orders yet'}
                      description={q ? 'Try a different PO number or supplier.' : 'Create a purchase order to start procuring stock.'}
                      action={q ? undefined : { label: '+ New Purchase Order', onClick: () => setShowNew(true) }}
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                orders.map((po) => (
                  <tr key={po.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-slate-900">{po.poNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{po.supplier?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{po.location.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {po.items.length} line(s) · {po.items.reduce((s, i) => s + i.quantity, 0)} unit(s)
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                      {money(po.items.reduce((s, i) => s + i.quantity * Number(i.unitCost), 0))}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(po.createdAt).toLocaleDateString()} · {po.createdBy.fullName}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {po.status === 'OPEN' && (
                        <>
                          <button
                            onClick={() => setReceiving(po)}
                            className="text-xs font-medium text-slate-900 underline underline-offset-2"
                          >
                            Receive
                          </button>
                          <button onClick={() => setCancelPo(po)} className="ml-3 text-xs font-medium text-red-600 hover:underline">
                            Cancel
                          </button>
                        </>
                      )}
                      {po.status === 'RECEIVED' && po.receipts.length > 0 && (
                        <span className="text-xs text-slate-400">{po.receipts.map((r) => r.grvNumber).join(', ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'grv' && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <SortableHeader label="GRV No." sortKey="grvNumber" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <th className="px-4 py-3">PO</th>
                <SortableHeader label="Supplier" sortKey="supplier" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Location" sortKey="location" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Subtotal" sortKey="subtotal" sortBy={sortBy} sortDir={sortDir} onSort={toggle} align="right" />
                <SortableHeader label="Withholding" sortKey="withholdingAmount" sortBy={sortBy} sortDir={sortDir} onSort={toggle} align="right" />
                <SortableHeader label="Net Payable" sortKey="netPayable" sortBy={sortBy} sortDir={sortDir} onSort={toggle} align="right" />
                <SortableHeader label="Received" sortKey="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={5} cols={9} />}
              {!loading && receipts.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title={q ? 'No receipts match your search' : 'No goods received yet'}
                      description={q ? 'Try a different GRV, PO or supplier.' : 'Receive an open purchase order to create a GRV.'}
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                receipts.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-slate-900">{r.grvNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.purchaseOrder?.poNumber || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{r.supplier?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{r.location.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(r.subtotal)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {r.withholdingType === 'NONE' ? '—' : `−${money(r.withholdingAmount)} (${Number(r.withholdingRate)}% ${r.withholdingType.toLowerCase()})`}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">{money(r.netPayable)}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(r.createdAt).toLocaleDateString()} · {r.receivedBy.fullName}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandedGrv(expandedGrv === r.id ? null : r.id)}
                          className="text-xs font-medium text-slate-900 underline underline-offset-2"
                        >
                          {expandedGrv === r.id ? 'Hide' : 'Items'}
                        </button>
                      </td>
                    </tr>
                    {expandedGrv === r.id && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={9} className="px-6 py-3">
                          <table className="w-full text-left text-xs">
                            <thead className="uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="py-1 pr-3">Product</th>
                                <th className="py-1 pr-3">Batch</th>
                                <th className="py-1 pr-3">Expiry</th>
                                <th className="py-1 pr-3 text-right">Qty</th>
                                <th className="py-1 pr-3 text-right">Unit Cost</th>
                                <th className="py-1 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.items.map((it) => (
                                <tr key={it.id} className="border-t border-slate-200">
                                  <td className="py-1.5 pr-3 text-slate-900">{it.product.code} — {it.product.genericName}</td>
                                  <td className="py-1.5 pr-3 text-slate-600">{it.batch.batchNo}</td>
                                  <td className="py-1.5 pr-3 text-slate-600">
                                    {it.batch.expiryDate ? new Date(it.batch.expiryDate).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums">{it.quantity}</td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums">{money(it.unitCost)}</td>
                                  <td className="py-1.5 text-right tabular-nums">{money(it.quantity * Number(it.unitCost))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
      )}

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

      <Drawer
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New Purchase Order"
        subtitle="Pick a supplier, receiving location and product lines"
        width="xl"
      >
        {showNew && (
          <NewOrderForm
            suppliers={suppliers}
            locations={locations}
            onDone={() => {
              setShowNew(false);
              toast.success('Purchase order created.');
              load('orders', q, page, pageSize, sortBy, sortDir).catch(() => {});
            }}
            onCancel={() => setShowNew(false)}
          />
        )}
      </Drawer>

      <Drawer
        open={receiving !== null}
        onClose={() => setReceiving(null)}
        title={receiving ? `Receive ${receiving.poNumber}` : 'Receive'}
        subtitle={
          receiving
            ? `Into ${receiving.location.name}${receiving.supplier ? ` — from ${receiving.supplier.name}` : ''}`
            : undefined
        }
        width="xl"
      >
        {receiving && (
          <ReceiveForm
            order={receiving}
            onDone={() => {
              setReceiving(null);
              toast.success('Goods received — stock updated.');
              load('orders', q, page, pageSize, sortBy, sortDir).catch(() => {});
            }}
            onCancel={() => setReceiving(null)}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={cancelPo !== null}
        title="Cancel purchase order?"
        message={
          <>
            <span className="font-mono text-xs font-medium text-slate-900">{cancelPo?.poNumber}</span> will be
            marked cancelled. It cannot be received afterwards.
          </>
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        danger
        busy={cancelBusy}
        onConfirm={confirmCancelOrder}
        onCancel={() => setCancelPo(null)}
      />
    </div>
  );
}
