'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

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
}

interface ProductOption {
  id: number;
  code: string;
  genericName: string;
  brandName: string | null;
  dispenseUnit: string | null;
  unitPrice: string;
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

// ── new PO form ──────────────────────────────────────────────

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
  const [supplierId, setSupplierId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [pickedProductId, setPickedProductId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  function addLine() {
    const product = productOptions.find((p) => p.id === Number(pickedProductId));
    if (!product) return;
    if (lines.some((l) => l.product.id === product.id)) return;
    setLines([
      ...lines,
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
    setError('');
    if (!locationId) {
      setError('Select a receiving location');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one product line');
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
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">New Purchase Order</h2>
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={label}>Supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`mt-1 w-full ${input}`}>
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Receiving location *</label>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={`mt-1 w-full ${input}`}>
            <option value="">Select…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 w-full ${input}`} />
        </div>
      </div>

      <div className="mt-5 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-medium text-slate-600">Add products</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Search products…"
            className={`w-56 ${input}`}
          />
          <select
            value={pickedProductId}
            onChange={(e) => setPickedProductId(e.target.value)}
            className={`w-72 ${input}`}
          >
            <option value="">Select product…</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.genericName}{p.brandName ? ` (${p.brandName})` : ''}
              </option>
            ))}
          </select>
          <button type="button" onClick={addLine} disabled={!pickedProductId} className={`${btnGhost} disabled:opacity-40`}>
            + Add line
          </button>
        </div>

        {lines.length > 0 && (
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
                    <input type="number" min="0" step="0.01" required value={l.unitCost}
                      onChange={(e) => setLine(i, { unitCost: e.target.value })} className={`w-28 ${input}`} />
                  </td>
                  <td className="py-2 pr-3">
                    <input value={l.batchNo} placeholder="(at receiving)"
                      onChange={(e) => setLine(i, { batchNo: e.target.value })} className={`w-32 ${input}`} />
                  </td>
                  <td className="py-2 pr-3">
                    <input type="date" value={l.expiryDate}
                      onChange={(e) => setLine(i, { expiryDate: e.target.value })} className={input} />
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

// ── receive form ─────────────────────────────────────────────

interface ReceiveLine {
  itemId: number;
  product: ProductOption;
  quantity: string;
  unitCost: string;
  batchNo: string;
  expiryDate: string;
}

function ReceiveForm({ order, onDone, onCancel }: { order: PO; onDone: () => void; onCancel: () => void }) {
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
  const [error, setError] = useState('');
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
    setError('');
    if (lines.some((l) => !l.batchNo.trim())) {
      setError('Every line needs a batch number');
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
      setError(err instanceof Error ? err.message : 'Receiving failed');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 rounded-lg border border-slate-900 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">
        Receive {order.poNumber} → {order.location.name}
        {order.supplier ? ` (from ${order.supplier.name})` : ''}
      </h2>
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <table className="mt-4 w-full text-left text-sm">
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
                <input type="number" min="0" step="0.01" required value={l.unitCost}
                  onChange={(e) => setLine(i, { unitCost: e.target.value })} className={`w-28 ${input}`} />
              </td>
              <td className="py-2 pr-3">
                <input required value={l.batchNo}
                  onChange={(e) => setLine(i, { batchNo: e.target.value })} className={`w-32 ${input}`} />
              </td>
              <td className="py-2 pr-3">
                <input type="date" value={l.expiryDate}
                  onChange={(e) => setLine(i, { expiryDate: e.target.value })} className={input} />
              </td>
              <td className="py-2 text-right tabular-nums">
                {money((Number(l.quantity) || 0) * (Number(l.unitCost) || 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-slate-200 pt-4">
        <div>
          <label className={label}>Withholding tax</label>
          <select
            value={whtType}
            onChange={(e) => {
              const opt = WHT_OPTIONS.find((o) => o.value === e.target.value)!;
              setWhtType(opt.value);
              setWhtRate(String(opt.defaultRate));
            }}
            className={`mt-1 ${input}`}
          >
            {WHT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
          <p className="text-slate-500">Withholding: <span className="tabular-nums font-medium text-slate-900">−{money(whtAmount)}</span></p>
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

type Tab = 'orders' | 'grv' | 'expenses';

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

interface Expense {
  id: number;
  description: string;
  category: string | null;
  amount: string;
  withholdingType: string;
  withholdingAmount: string;
  netPayable: string;
  purchasedAt: string;
  supplier: { name: string } | null;
  createdBy: { fullName: string };
}

export default function ProcurementPage() {
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<PO[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [receiving, setReceiving] = useState<PO | null>(null);
  const [expandedGrv, setExpandedGrv] = useState<number | null>(null);
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // expense form state
  const [exp, setExp] = useState({ description: '', category: '', supplierId: '', amount: '', whtType: 'NONE', whtRate: '0', notes: '' });
  const [expSaving, setExpSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    const d = await api<{ orders: PO[] }>('/api/procurement/orders?pageSize=50');
    setOrders(d.orders);
  }, []);
  const loadReceipts = useCallback(async () => {
    const d = await api<{ receipts: Receipt[] }>('/api/procurement/receipts?pageSize=50');
    setReceipts(d.receipts);
  }, []);
  const loadExpenses = useCallback(async () => {
    const d = await api<{ expenses: Expense[] }>('/api/procurement/expenses?pageSize=50');
    setExpenses(d.expenses);
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
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setError('');
    const run = tab === 'orders' ? loadOrders : tab === 'grv' ? loadReceipts : loadExpenses;
    run().catch((e) => setError(e.message));
  }, [tab, loadOrders, loadReceipts, loadExpenses]);

  async function cancelOrder(po: PO) {
    setError('');
    try {
      await api(`/api/procurement/orders/${po.id}/cancel`, { method: 'POST' });
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    }
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setExpSaving(true);
    try {
      await api('/api/procurement/expenses', {
        method: 'POST',
        body: JSON.stringify({
          description: exp.description,
          category: exp.category || null,
          supplierId: exp.supplierId ? Number(exp.supplierId) : null,
          amount: Number(exp.amount),
          withholdingType: exp.whtType,
          withholdingRate: Number(exp.whtRate) || 0,
          notes: exp.notes || null,
        }),
      });
      setShowNewExpense(false);
      setExp({ description: '', category: '', supplierId: '', amount: '', whtType: 'NONE', whtRate: '0', notes: '' });
      await loadExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setExpSaving(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'orders', label: 'Purchase Orders' },
    { key: 'grv', label: 'GRV History' },
    { key: 'expenses', label: 'Other Purchases' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Procurement</h1>
          <p className="mt-1 text-sm text-slate-500">Purchase orders, goods receiving and non-sale purchases.</p>
        </div>
        {tab === 'orders' && !showNew && !receiving && (
          <button onClick={() => setShowNew(true)} className={btnPrimary}>+ New Purchase Order</button>
        )}
        {tab === 'expenses' && !showNewExpense && (
          <button onClick={() => setShowNewExpense(true)} className={btnPrimary}>+ Record Purchase</button>
        )}
      </div>

      <div className="mt-5 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setShowNew(false); setReceiving(null); setNotice(''); }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{notice}</p>
      )}

      {tab === 'orders' && (
        <div>
          {showNew && (
            <NewOrderForm
              suppliers={suppliers}
              locations={locations}
              onDone={() => { setShowNew(false); setNotice('Purchase order created.'); loadOrders().catch(() => {}); }}
              onCancel={() => setShowNew(false)}
            />
          )}
          {receiving && (
            <ReceiveForm
              order={receiving}
              onDone={() => { setReceiving(null); setNotice('Goods received — stock updated.'); loadOrders().catch(() => {}); }}
              onCancel={() => setReceiving(null)}
            />
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">PO No.</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No purchase orders yet.</td></tr>
                )}
                {orders.map((po) => (
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
                            onClick={() => { setReceiving(po); setShowNew(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="text-xs font-medium text-slate-900 underline underline-offset-2"
                          >
                            Receive
                          </button>
                          <button onClick={() => cancelOrder(po)} className="ml-3 text-xs font-medium text-slate-500 hover:underline">
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
        </div>
      )}

      {tab === 'grv' && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">GRV No.</th>
                <th className="px-4 py-3">PO</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Withholding</th>
                <th className="px-4 py-3 text-right">Net Payable</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No goods received yet.</td></tr>
              )}
              {receipts.map((r) => (
                <>
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
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
                    <tr key={`${r.id}-detail`} className="border-b border-slate-100 bg-slate-50">
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
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'expenses' && (
        <div>
          {showNewExpense && (
            <form onSubmit={saveExpense} className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Record Non-Sale Purchase</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className={label}>Description *</label>
                  <input required value={exp.description}
                    onChange={(e) => setExp({ ...exp, description: e.target.value })}
                    placeholder="e.g. Office supplies — printer paper"
                    className={`mt-1 w-full ${input}`} />
                </div>
                <div>
                  <label className={label}>Category</label>
                  <input value={exp.category}
                    onChange={(e) => setExp({ ...exp, category: e.target.value })}
                    placeholder="Office supplies" className={`mt-1 w-full ${input}`} />
                </div>
                <div>
                  <label className={label}>Supplier</label>
                  <select value={exp.supplierId} onChange={(e) => setExp({ ...exp, supplierId: e.target.value })}
                    className={`mt-1 w-full ${input}`}>
                    <option value="">—</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Amount *</label>
                  <input required type="number" min="0.01" step="0.01" value={exp.amount}
                    onChange={(e) => setExp({ ...exp, amount: e.target.value })} className={`mt-1 w-full ${input}`} />
                </div>
                <div>
                  <label className={label}>Withholding</label>
                  <select
                    value={exp.whtType}
                    onChange={(e) => {
                      const opt = WHT_OPTIONS.find((o) => o.value === e.target.value)!;
                      setExp({ ...exp, whtType: opt.value, whtRate: String(opt.defaultRate) });
                    }}
                    className={`mt-1 w-full ${input}`}
                  >
                    {WHT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {exp.whtType !== 'NONE' && (
                  <div>
                    <label className={label}>Rate %</label>
                    <input type="number" min="0" max="100" step="0.01" value={exp.whtRate}
                      onChange={(e) => setExp({ ...exp, whtRate: e.target.value })} className={`mt-1 w-full ${input}`} />
                  </div>
                )}
                <div>
                  <label className={label}>Notes</label>
                  <input value={exp.notes} onChange={(e) => setExp({ ...exp, notes: e.target.value })}
                    className={`mt-1 w-full ${input}`} />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button type="submit" disabled={expSaving} className={btnPrimary}>
                  {expSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowNewExpense(false)} className={btnGhost}>Cancel</button>
              </div>
            </form>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Withholding</th>
                  <th className="px-4 py-3 text-right">Net Payable</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No non-sale purchases recorded.</td></tr>
                )}
                {expenses.map((x) => (
                  <tr key={x.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{x.description}</td>
                    <td className="px-4 py-3 text-slate-600">{x.category || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{x.supplier?.name || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(x.amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {x.withholdingType === 'NONE' ? '—' : `−${money(x.withholdingAmount)}`}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">{money(x.netPayable)}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(x.purchasedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-500">{x.createdBy.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
