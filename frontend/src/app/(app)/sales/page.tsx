'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getTokens } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Combobox, ComboOption } from '@/components/ui/combobox';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';
import { Icon } from '@/components/icons';
import { Tabs } from '@/components/ui/tabs';

const input =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';
const btnPrimary =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50';
const btnGhost =
  'rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50';

function money(v: string | number) {
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function expiryBadge(expiry: string | null) {
  if (!expiry) return null;
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0)
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">Expired</span>;
  if (days <= 90)
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{days}d left</span>;
  return null;
}

const WHT_OPTIONS = [
  { value: 'NONE', label: 'No withholding', defaultRate: 0 },
  { value: 'GOODS', label: 'Goods', defaultRate: 2 },
  { value: 'SERVICES', label: 'Services', defaultRate: 2 },
];

interface Option {
  id: number;
  name: string;
  isActive?: boolean;
}

interface StockRow {
  batchId: number;
  productId: number;
  code: string;
  genericName: string;
  brandName: string | null;
  dispenseUnit: string | null;
  unitPrice: string;
  quantity: number;
  batchNo: string;
  expiryDate: string | null;
  location: Option;
}

interface CartLine {
  stock: StockRow;
  quantity: string;
  unitPrice: string;
}

interface OrderDetail {
  id: number;
  dspNumber: string;
  paymentType: string;
  subtotal: string;
  withholdingType: string;
  withholdingRate: string;
  withholdingAmount: string;
  total: string;
  notes: string | null;
  createdAt: string;
  location: Option;
  customer: { id: number; name: string; phone: string | null } | null;
  dispensedBy: { fullName: string };
  items: {
    id: number;
    quantity: number;
    listPrice: string;
    unitPrice: string;
    product: { code: string; genericName: string; brandName: string | null; dispenseUnit: string | null };
    batch: { batchNo: string; expiryDate: string | null };
  }[];
  attachments: { id: number; originalName: string; size: number; createdAt: string }[];
}

// ── printable slip ───────────────────────────────────────────

function Slip({ order }: { order: OrderDetail }) {
  const settings = useSettings();
  const tagline = [settings?.pharmacyAddress, settings?.pharmacyPhone].filter(Boolean).join(' · ');
  return (
    <div id="dispense-slip" className="rounded-lg border border-slate-200 bg-white p-6 print:border-0 print:p-0">
      <div className="flex items-start justify-between border-b border-slate-300 pb-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="" className="h-12 w-12 shrink-0 object-contain" />
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {settings?.pharmacyName || 'FortInventory'}
            </h2>
            <p className="text-sm text-slate-500">{tagline ? `${tagline} — ` : ''}Dispense Slip</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono font-semibold text-slate-900">{order.dspNumber}</p>
          <p className="text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm md:grid-cols-3">
        <p><span className="text-slate-500">Location:</span> <span className="font-medium text-slate-900">{order.location.name}</span></p>
        <p><span className="text-slate-500">Dispensed by:</span> <span className="text-slate-900">{order.dispensedBy.fullName}</span></p>
        <p><span className="text-slate-500">Payment:</span> <span className="text-slate-900">{order.paymentType === 'CASH' ? 'Cash' : 'Credit'}</span></p>
        {order.customer && (
          <p>
            <span className="text-slate-500">Customer:</span>{' '}
            <span className="text-slate-900">
              {order.customer.name}{order.customer.phone ? ` · ${order.customer.phone}` : ''}
            </span>
          </p>
        )}
        {order.notes && <p className="col-span-2"><span className="text-slate-500">Notes:</span> <span className="text-slate-900">{order.notes}</span></p>}
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Product</th>
              <th className="py-2 pr-3">Batch</th>
              <th className="py-2 pr-3">Expiry</th>
              <th className="py-2 pr-3 text-right">Qty</th>
              <th className="py-2 pr-3">Unit</th>
              <th className="py-2 pr-3 text-right">Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
                <td className="py-2 pr-3">
                  <span className="font-medium text-slate-900">{it.product.genericName}</span>
                  {it.product.brandName && <span className="text-slate-500"> ({it.product.brandName})</span>}
                  <span className="ml-1 font-mono text-xs text-slate-400">{it.product.code}</span>
                </td>
                <td className="py-2 pr-3 text-slate-600">{it.batch.batchNo}</td>
                <td className="py-2 pr-3 text-slate-600">
                  {it.batch.expiryDate ? new Date(it.batch.expiryDate).toLocaleDateString() : '—'}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{it.quantity}</td>
                <td className="py-2 pr-3 text-slate-600">{it.product.dispenseUnit || '—'}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(it.unitPrice)}</td>
                <td className="py-2 text-right tabular-nums">{money(it.quantity * Number(it.unitPrice))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="w-64 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Subtotal</span>
            <span className="tabular-nums text-slate-900">{money(order.subtotal)}</span>
          </div>
          {order.withholdingType !== 'NONE' && (
            <div className="flex justify-between py-1">
              <span className="text-slate-500">
                Withholding ({Number(order.withholdingRate)}% {order.withholdingType.toLowerCase()})
              </span>
              <span className="tabular-nums text-slate-900">−{money(order.withholdingAmount)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-slate-300 py-2 font-semibold">
            <span className="text-slate-900">Total</span>
            <span className="tabular-nums text-slate-900">{money(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-16 text-sm">
        <div>
          <div className="border-t border-slate-400 pt-1 text-slate-500">Dispensed by (signature)</div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 text-slate-500">Received by (signature)</div>
        </div>
      </div>
    </div>
  );
}

// ── printable sales history report ──────────────────────────

function SalesHistoryReport({
  orders,
  from,
  to,
  q,
}: {
  orders: OrderDetail[];
  from: string;
  to: string;
  q: string;
}) {
  const settings = useSettings();
  const tagline = [settings?.pharmacyAddress, settings?.pharmacyPhone].filter(Boolean).join(' · ');
  const totals = orders.reduce(
    (acc, o) => {
      acc.count += 1;
      acc.total += Number(o.total);
      if (o.paymentType === 'CASH') acc.cash += Number(o.total);
      else acc.credit += Number(o.total);
      return acc;
    },
    { count: 0, total: 0, cash: 0, credit: 0 },
  );

  return (
    <div id="sales-history-report" className="rounded-lg border border-slate-200 bg-white p-6 print:border-0 print:p-0">
      <div className="flex items-start justify-between border-b border-slate-300 pb-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="" className="h-12 w-12 shrink-0 object-contain" />
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {settings?.pharmacyName || 'FortInventory'}
            </h2>
            <p className="text-sm text-slate-500">{tagline ? `${tagline} — ` : ''}Sales History Report</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium text-slate-900">
            {from || to ? `${from || 'Earliest'} → ${to || 'Today'}` : 'All time'}
          </p>
          <p className="text-slate-500">Generated {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm md:grid-cols-4">
        <p><span className="text-slate-500">Orders:</span> <span className="font-medium text-slate-900">{totals.count}</span></p>
        <p><span className="text-slate-500">Total:</span> <span className="font-medium text-slate-900">{money(totals.total)}</span></p>
        <p><span className="text-slate-500">Cash:</span> <span className="text-slate-900">{money(totals.cash)}</span></p>
        <p><span className="text-slate-500">Credit:</span> <span className="text-slate-900">{money(totals.credit)}</span></p>
        {q && <p className="col-span-2 md:col-span-4"><span className="text-slate-500">Search filter:</span> <span className="text-slate-900">&ldquo;{q}&rdquo;</span></p>}
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-3">DSP No.</th>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Location</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Payment</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">No sales match the selected filters.</td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-mono text-xs text-slate-900">{o.dspNumber}</td>
                <td className="py-2 pr-3 text-slate-600">{new Date(o.createdAt).toLocaleDateString()}</td>
                <td className="py-2 pr-3 text-slate-600">{o.location.name}</td>
                <td className="py-2 pr-3 text-slate-600">{o.customer?.name || 'Walk-in'}</td>
                <td className="py-2 pr-3 text-slate-600">{o.paymentType === 'CASH' ? 'Cash' : 'Credit'}</td>
                <td className="py-2 text-right tabular-nums text-slate-900">{money(o.total)}</td>
              </tr>
            ))}
          </tbody>
          {orders.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-300 font-semibold">
                <td colSpan={5} className="py-2 pr-3 text-right text-slate-600">Total</td>
                <td className="py-2 text-right tabular-nums text-slate-900">{money(totals.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-16 text-sm">
        <div>
          <div className="border-t border-slate-400 pt-1 text-slate-500">Prepared by (signature)</div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 text-slate-500">Approved by (signature)</div>
        </div>
      </div>
    </div>
  );
}

// ── new dispense flow: pick → editable summary → confirm ────

function NewDispense({ locations, onDispensed }: { locations: Option[]; onDispensed: (o: OrderDetail) => void }) {
  const toast = useToast();
  const settings = useSettings();
  const [locationId, setLocationId] = useState('');
  const [stockQuery, setStockQuery] = useState('');
  const [stockOptions, setStockOptions] = useState<StockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerOptions, setCustomerOptions] = useState<ComboOption[]>([]);
  const [paymentType, setPaymentType] = useState('CASH');
  const [whtType, setWhtType] = useState('NONE');
  const [whtRate, setWhtRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'items' | 'dispense'>('items');

  useEffect(() => {
    if (!locationId) {
      setStockOptions([]);
      return;
    }
    setStockLoading(true);
    const params = new URLSearchParams({ locationId, pageSize: '20', active: 'true' });
    if (stockQuery) params.set('q', stockQuery);
    api<{ items: StockRow[] }>(`/api/inventory?${params}`)
      .then((d) => setStockOptions(d.items))
      .catch((e) => toast.error(e.message))
      .finally(() => setStockLoading(false));
  }, [locationId, stockQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchCustomers = useCallback((term: string) => {
    api<{ customers: { id: number; name: string; phone: string | null }[] }>(
      `/api/customers?active=true&q=${encodeURIComponent(term)}`,
    )
      .then((d) =>
        setCustomerOptions(
          d.customers.map((c) => ({ value: String(c.id), label: c.name, sublabel: c.phone || undefined })),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    searchCustomers('');
  }, [searchCustomers]);

  async function createCustomer(name: string) {
    try {
      const d = await api<{ customer: { id: number; name: string; phone: string | null } }>('/api/customers', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setCustomerOptions((prev) => [{ value: String(d.customer.id), label: d.customer.name }, ...prev]);
      setCustomerId(String(d.customer.id));
      toast.success(`Customer "${d.customer.name}" added.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add customer');
    }
  }

  function addToCart(s: StockRow) {
    if (cart.some((c) => c.stock.batchId === s.batchId)) return;
    setCart([...cart, { stock: s, quantity: '1', unitPrice: String(s.unitPrice) }]);
  }

  function setLine(i: number, patch: Partial<CartLine>) {
    setCart(cart.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function stepQty(i: number, delta: number) {
    const c = cart[i];
    const current = Number(c.quantity) || 0;
    const next = Math.min(c.stock.quantity, Math.max(1, current + delta));
    setLine(i, { quantity: String(next) });
  }

  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + (Number(c.quantity) || 0) * (Number(c.unitPrice) || 0), 0),
    [cart],
  );
  const whtAmount = whtType === 'NONE' ? 0 : (subtotal * (Number(whtRate) || 0)) / 100;

  async function confirm() {
    for (const c of cart) {
      const q = Number(c.quantity);
      if (!Number.isInteger(q) || q <= 0) {
        toast.error(`Enter a valid quantity for ${c.stock.genericName}`);
        return;
      }
      if (q > c.stock.quantity) {
        toast.error(`Only ${c.stock.quantity} of ${c.stock.genericName} (batch ${c.stock.batchNo}) available`);
        return;
      }
      if (!(Number(c.unitPrice) > 0)) {
        toast.error(`Enter a sale price greater than zero for ${c.stock.genericName}`);
        return;
      }
    }
    setSaving(true);
    try {
      const d = await api<{ order: OrderDetail }>('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          locationId: Number(locationId),
          customerId: customerId ? Number(customerId) : null,
          paymentType,
          withholdingType: whtType,
          withholdingRate: Number(whtRate) || 0,
          notes: notes || null,
          items: cart.map((c) => ({
            batchId: c.stock.batchId,
            quantity: Number(c.quantity),
            unitPrice: Number(c.unitPrice),
          })),
        }),
      });
      setCart([]);
      setNotes('');
      setCustomerId('');
      onDispensed(d.order);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dispensing failed');
      setSaving(false);
    }
  }

  return (
    <div className={`mt-4 ${step === 'dispense' && cart.length > 0 ? 'pb-28 sm:pb-4' : ''} ${step === 'items' && cart.length > 0 ? 'pb-24 sm:pb-4' : ''}`}>
      {/* Step indicator — choosing items and dispensing (payment, customer, confirm) are
          deliberately separate steps on every device, not one long stacked page. */}
      <div className="mb-4 flex items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => setStep('items')}
          className={`flex items-center gap-2 text-sm font-medium ${step === 'items' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === 'items' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
            1
          </span>
          Choose items
        </button>
        <div className="h-px w-8 shrink-0 bg-slate-200" />
        <span className={`flex items-center gap-2 text-sm font-medium ${step === 'dispense' ? 'text-slate-900' : 'text-slate-400'}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === 'dispense' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
            2
          </span>
          Dispense
        </span>
      </div>

      {step === 'items' && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={label}>Dispense from location *</label>
                <Select
                  value={locationId}
                  onChange={(v) => {
                    setLocationId(v);
                    setCart([]);
                  }}
                  placeholder="Select…"
                  options={locations.filter((l) => l.isActive).map((l) => ({ value: String(l.id), label: l.name }))}
                  className="mt-1"
                />
              </div>
              {locationId && (
                <div className="sm:col-span-2">
                  <label className={label}>Search stock (product, batch…)</label>
                  <SearchInput
                    onSearch={setStockQuery}
                    placeholder="Type to search available stock…"
                    className="mt-1 w-full"
                  />
                </div>
              )}
            </div>

            {locationId && (
              <>
                {/* Mobile: card list — a 6-column table is unusable on a phone */}
                <div className="mt-4 space-y-2 sm:hidden">
                  {stockLoading &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                  {!stockLoading && stockOptions.length === 0 && (
                    <p className="rounded-md border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                      No stock at this location.
                    </p>
                  )}
                  {!stockLoading &&
                    stockOptions.map((s) => {
                      const inCart = cart.some((c) => c.stock.batchId === s.batchId);
                      return (
                        <div key={s.batchId} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {s.genericName}
                                {s.brandName && <span className="font-normal text-slate-500"> ({s.brandName})</span>}
                              </p>
                              <p className="font-mono text-xs text-slate-400">{s.code}</p>
                            </div>
                            <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                              {money(s.unitPrice)}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                            <span>Batch {s.batchNo}</span>
                            <span className="text-slate-300">·</span>
                            <span>{s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : 'No expiry'}</span>
                            {expiryBadge(s.expiryDate)}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-xs text-slate-500">
                              Available <span className="font-semibold tabular-nums text-slate-900">{s.quantity}</span>{' '}
                              {s.dispenseUnit || ''}
                            </p>
                            <button
                              onClick={() => addToCart(s)}
                              disabled={inCart}
                              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                inCart
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-900 text-white hover:bg-slate-700'
                              }`}
                            >
                              <Icon name={inCart ? 'check' : 'cart'} className="h-3.5 w-3.5" />
                              {inCart ? 'Added' : 'Add'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Tablet/desktop: dense table */}
                <div className="mt-4 hidden max-h-56 overflow-y-auto rounded-md border border-slate-200 sm:block">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Batch</th>
                        <th className="px-3 py-2">Expiry</th>
                        <th className="px-3 py-2 text-right">Available</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockLoading && <SkeletonRows rows={3} cols={6} />}
                      {!stockLoading && stockOptions.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No stock at this location.</td></tr>
                      )}
                      {!stockLoading &&
                        stockOptions.map((s) => {
                          const inCart = cart.some((c) => c.stock.batchId === s.batchId);
                          return (
                            <tr key={s.batchId} className="border-t border-slate-100">
                              <td className="px-3 py-2">
                                <span className="font-medium text-slate-900">{s.genericName}</span>
                                {s.brandName && <span className="text-slate-500"> ({s.brandName})</span>}
                                <span className="ml-1 font-mono text-xs text-slate-400">{s.code}</span>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{s.batchNo}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : '—'}
                                {' '}{expiryBadge(s.expiryDate)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{s.quantity}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{money(s.unitPrice)}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => addToCart(s)}
                                  disabled={inCart}
                                  className="text-xs font-medium text-slate-900 underline underline-offset-2 disabled:text-slate-300 disabled:no-underline"
                                >
                                  {inCart ? 'Added' : '+ Add'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {cart.length > 0 && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Selected items</h2>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700">
                  {cart.length} item{cart.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {cart.map((c, i) => (
                  <li key={c.stock.batchId} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{c.stock.genericName}</p>
                      <p className="text-xs text-slate-400">
                        {c.stock.code} · batch {c.stock.batchNo} · qty {c.quantity}
                      </p>
                    </div>
                    <button
                      onClick={() => setCart(cart.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${c.stock.genericName}`}
                      className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setStep('dispense')}
                className="mt-4 hidden items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 sm:inline-flex"
              >
                Continue to Dispense ({cart.length})
                <Icon name="arrowRight" className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Mobile: sticky continue bar */}
          {cart.length > 0 && (
            <div
              className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] sm:hidden print:hidden"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <button
                onClick={() => setStep('dispense')}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 py-3 text-sm font-semibold text-white"
              >
                Continue · {cart.length} item{cart.length === 1 ? '' : 's'} · {money(subtotal)}
                <Icon name="arrowRight" className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {step === 'dispense' && cart.length > 0 && (
        <div className="rounded-lg border border-slate-900 bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={() => setStep('items')}
                className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <Icon name="arrowRight" className="h-3.5 w-3.5 rotate-180" />
                Back to items
              </button>
              <h2 className="text-sm font-semibold text-slate-900">Dispense Summary</h2>
              <p className="text-xs text-slate-500">Review quantities and prices before confirming.</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700">
              {cart.length} item{cart.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Mobile: card list with a quantity stepper and larger tap targets */}
          <div className="mt-4 space-y-3 sm:hidden">
            {cart.map((c, i) => (
              <div key={c.stock.batchId} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{c.stock.genericName}</p>
                    <p className="text-xs text-slate-400">
                      {c.stock.code} · batch {c.stock.batchNo} · {c.stock.quantity} available
                    </p>
                  </div>
                  <button
                    onClick={() => setCart(cart.filter((_, idx) => idx !== i))}
                    aria-label={`Remove ${c.stock.genericName}`}
                    className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Quantity</label>
                    <div className="mt-1 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => stepQty(i, -1)}
                        aria-label="Decrease quantity"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-base text-slate-600 hover:bg-slate-50"
                      >
                        −
                      </button>
                      <input
                        type="number" min="1" max={c.stock.quantity} step="1"
                        value={c.quantity}
                        onChange={(e) => setLine(i, { quantity: e.target.value })}
                        className="w-full min-w-0 rounded-md border border-slate-300 px-1 py-2 text-center text-sm focus:border-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => stepQty(i, 1)}
                        aria-label="Increase quantity"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-base text-slate-600 hover:bg-slate-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Sale Price</label>
                    <input
                      type="number" min="0.01" step="0.01"
                      value={c.unitPrice}
                      onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
                  <span className="text-slate-500">List price {money(c.stock.unitPrice)}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {money((Number(c.quantity) || 0) * (Number(c.unitPrice) || 0))}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet/desktop: dense table */}
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3 text-right">Available</th>
                  <th className="py-2 pr-3">Quantity</th>
                  <th className="py-2 pr-3 text-right">List Price</th>
                  <th className="py-2 pr-3">Sale Price (this sale)</th>
                  <th className="py-2 pr-3 text-right">Line Total</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {cart.map((c, i) => (
                  <tr key={c.stock.batchId} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-900">{c.stock.genericName}</p>
                      <p className="text-xs text-slate-400">{c.stock.code}</p>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{c.stock.batchNo}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{c.stock.quantity}</td>
                    <td className="py-2 pr-3">
                      <input
                        type="number" min="1" max={c.stock.quantity} step="1"
                        value={c.quantity}
                        onChange={(e) => setLine(i, { quantity: e.target.value })}
                        className={`w-24 ${input}`}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{money(c.stock.unitPrice)}</td>
                    <td className="py-2 pr-3">
                      <input
                        type="number" min="0.01" step="0.01"
                        value={c.unitPrice}
                        onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                        className={`w-28 ${input}`}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium">
                      {money((Number(c.quantity) || 0) * (Number(c.unitPrice) || 0))}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => setCart(cart.filter((_, idx) => idx !== i))}
                        className="text-xs text-slate-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={label}>Customer (optional)</label>
              <Combobox
                options={customerOptions}
                value={customerId}
                onChange={setCustomerId}
                onSearch={searchCustomers}
                onCreate={createCustomer}
                placeholder="Walk-in — search or add…"
                className="mt-1"
              />
            </div>
            <div>
              <label className={label}>Payment</label>
              <Select
                value={paymentType}
                onChange={setPaymentType}
                options={[
                  { value: 'CASH', label: 'Cash' },
                  { value: 'CREDIT', label: 'Credit' },
                ]}
                className="mt-1"
              />
            </div>
            <div>
              <label className={label}>Withholding tax</label>
              <Select
                value={whtType}
                onChange={(v) => {
                  const opt = WHT_OPTIONS.find((o) => o.value === v)!;
                  setWhtType(opt.value);
                  const rate =
                    opt.value === 'GOODS' ? settings?.whtGoodsRate ?? opt.defaultRate
                    : opt.value === 'SERVICES' ? settings?.whtServicesRate ?? opt.defaultRate
                    : 0;
                  setWhtRate(String(rate));
                }}
                options={WHT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                className="mt-1"
              />
            </div>
            {whtType !== 'NONE' && (
              <div>
                <label className={label}>Rate %</label>
                <input type="number" min="0" max="100" step="0.01" value={whtRate}
                  onChange={(e) => setWhtRate(e.target.value)} className={`mt-1 w-full ${input}`} />
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <label className={label}>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 w-full ${input}`} />
            </div>
          </div>

          <div className="mt-4 rounded-md bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="tabular-nums text-slate-900">{money(subtotal)}</span>
            </div>
            {whtType !== 'NONE' && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-slate-500">Withholding ({Number(whtRate)}%)</span>
                <span className="tabular-nums text-slate-900">−{money(whtAmount)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="text-sm font-semibold text-slate-900">Total</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">{money(subtotal - whtAmount)}</span>
            </div>
          </div>

          <div className="mt-5 hidden gap-2 sm:flex">
            <button onClick={confirm} disabled={saving} className={btnPrimary}>
              {saving ? 'Dispensing…' : 'Confirm Dispense'}
            </button>
            <button onClick={() => setCart([])} disabled={saving} className={`${btnGhost} disabled:opacity-50`}>Clear</button>
          </div>
        </div>
      )}

      {/* Mobile: sticky action bar so Confirm is always reachable without scrolling past the whole cart */}
      {step === 'dispense' && cart.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] sm:hidden print:hidden"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] text-slate-500">
                {cart.length} item{cart.length === 1 ? '' : 's'} · Total
              </p>
              <p className="truncate text-base font-bold tabular-nums text-slate-900">
                {money(subtotal - whtAmount)}
              </p>
            </div>
            <button
              onClick={() => setCart([])}
              disabled={saving}
              className="shrink-0 rounded-md border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              onClick={confirm}
              disabled={saving}
              className="shrink-0 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Dispensing…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── main page ────────────────────────────────────────────────

export default function SalesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'dispense' | 'history'>('dispense');
  const [locations, setLocations] = useState<Option[]>([]);
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [slipOrder, setSlipOrder] = useState<OrderDetail | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<number | null>(null);
  const [printReport, setPrintReport] = useState(false);
  const [printOrders, setPrintOrders] = useState<OrderDetail[]>([]);
  const [printBusy, setPrintBusy] = useState(false);
  const { sortBy, sortDir, toggle } = useSort('createdAt', 'desc');

  const loadOrders = useCallback(async (search: string, pageNum: number, size: number, f: string, t: string, sBy: string, sDir: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size), sortBy: sBy, sortDir: sDir });
      if (search) params.set('q', search);
      if (f) params.set('from', f);
      if (t) params.set('to', t);
      const d = await api<{ orders: OrderDetail[]; total: number }>(`/api/sales?${params}`);
      setOrders(d.orders);
      setTotal(d.total);
    } finally {
      setLoading(false);
    }
  }, []);

  async function openPrintReport() {
    setPrintBusy(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '500' });
      if (q) params.set('q', q);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const d = await api<{ orders: OrderDetail[]; total: number }>(`/api/sales?${params}`);
      setPrintOrders(d.orders);
      setPrintReport(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load sales history');
    } finally {
      setPrintBusy(false);
    }
  }

  useEffect(() => {
    api<{ locations: Option[] }>('/api/locations')
      .then((d) => setLocations(d.locations))
      .catch((e) => toast.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'history') loadOrders(q, page, pageSize, from, to, sortBy, sortDir).catch((e) => toast.error(e.message));
  }, [tab, q, page, pageSize, from, to, sortBy, sortDir, loadOrders]); // eslint-disable-line react-hooks/exhaustive-deps

  function onDispensed(order: OrderDetail) {
    setSlipOrder(order);
    toast.success(`${order.dspNumber} dispensed — stock updated.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploadTarget === null) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api(`/api/sales/${uploadTarget}/attachments`, { method: 'POST', body: fd });
      toast.success(`"${file.name}" attached.`);
      await loadOrders(q, page, pageSize, from, to, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      setUploadTarget(null);
    }
  }

  async function downloadAttachment(orderId: number, attId: number, name: string) {
    try {
      const res = await fetch(`/api/sales/${orderId}/attachments/${attId}`, {
        headers: { Authorization: `Bearer ${getTokens()?.accessToken}` },
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales & Dispensing</h1>
          <p className="mt-1 text-sm text-slate-500">Dispense stock, print slips and browse sales history.</p>
        </div>
        {slipOrder && (
          <button onClick={() => window.print()} className={btnPrimary}>Print Slip</button>
        )}
        {printReport && (
          <button onClick={() => window.print()} className={btnPrimary}>Print</button>
        )}
      </div>

      <Tabs
        className="mt-5 print:hidden"
        value={tab}
        onChange={(v) => {
          const t = v as 'dispense' | 'history';
          setTab(t);
          setSlipOrder(null);
          setPrintReport(false);
          setQ('');
          setPage(1);
        }}
        tabs={[
          { key: 'dispense', label: 'New Dispense' },
          { key: 'history', label: 'Sales History' },
        ]}
      />

      {slipOrder && (
        <div className="mt-4">
          <Slip order={slipOrder} />
          <button onClick={() => setSlipOrder(null)} className={`mt-3 ${btnGhost} print:hidden`}>
            Close slip
          </button>
        </div>
      )}

      {printReport && (
        <div className="mt-4">
          <SalesHistoryReport orders={printOrders} from={from} to={to} q={q} />
          <button onClick={() => setPrintReport(false)} className={`mt-3 ${btnGhost} print:hidden`}>
            Close report
          </button>
        </div>
      )}

      {tab === 'dispense' && !slipOrder && !printReport && <NewDispense locations={locations} onDispensed={onDispensed} />}

      {tab === 'history' && !slipOrder && !printReport && (
        <div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <SearchInput
                onSearch={(term) => {
                  setQ(term);
                  setPage(1);
                }}
                placeholder="Search DSP no. or product…"
                className="w-72"
              />
              <div>
                <label className={label}>Date range</label>
                <DateRangePicker
                  from={from}
                  to={to}
                  onChange={(r) => {
                    setFrom(r.from);
                    setTo(r.to);
                    setPage(1);
                  }}
                  placeholder="All time"
                  className="mt-1"
                />
              </div>
            </div>
            <button onClick={openPrintReport} disabled={printBusy} className={`${btnGhost} disabled:opacity-50`}>
              {printBusy ? 'Preparing…' : 'Print Sales History'}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <input ref={fileRef} type="file" onChange={onUpload} className="hidden" />
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <SortableHeader label="DSP No." sortKey="dspNumber" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                  <SortableHeader label="Location" sortKey="location" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                  <SortableHeader label="Customer" sortKey="customer" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                  <th className="px-4 py-3">Items</th>
                  <SortableHeader label="Payment" sortKey="paymentType" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                  <SortableHeader label="Total" sortKey="total" sortBy={sortBy} sortDir={sortDir} onSort={toggle} align="right" />
                  <SortableHeader label="Date · By" sortKey="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonRows rows={5} cols={8} />}
                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        title={q ? 'No sales match your search' : 'No sales yet'}
                        description={q ? 'Try a different DSP number or product name.' : 'Dispense stock from the New Dispense tab.'}
                      />
                    </td>
                  </tr>
                )}
                {!loading &&
                  orders.map((o) => (
                    <Fragment key={o.id}>
                      <tr className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 font-mono text-xs text-slate-900">{o.dspNumber}</td>
                        <td className="px-4 py-3 text-slate-600">{o.location.name}</td>
                        <td className="px-4 py-3 text-slate-600">{o.customer?.name || <span className="text-slate-400">Walk-in</span>}</td>
                        <td className="px-4 py-3 text-slate-600">{o.items.length} line(s)</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            o.paymentType === 'CASH' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {o.paymentType === 'CASH' ? 'Cash' : 'Credit'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{money(o.total)}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(o.createdAt).toLocaleDateString()} · {o.dispensedBy.fullName}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setSlipOrder(o)} className="text-xs font-medium text-slate-900 underline underline-offset-2">
                            Slip
                          </button>
                          <button
                            onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                            className="ml-3 text-xs font-medium text-slate-500 hover:underline"
                          >
                            {expanded === o.id ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {expanded === o.id && (
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td colSpan={8} className="px-6 py-3">
                            <table className="w-full text-left text-xs">
                              <thead className="uppercase tracking-wide text-slate-500">
                                <tr>
                                  <th className="py-1 pr-3">Product</th>
                                  <th className="py-1 pr-3">Batch</th>
                                  <th className="py-1 pr-3 text-right">Qty</th>
                                  <th className="py-1 pr-3 text-right">List</th>
                                  <th className="py-1 pr-3 text-right">Sold At</th>
                                  <th className="py-1 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {o.items.map((it) => (
                                  <tr key={it.id} className="border-t border-slate-200">
                                    <td className="py-1.5 pr-3 text-slate-900">{it.product.code} — {it.product.genericName}</td>
                                    <td className="py-1.5 pr-3 text-slate-600">{it.batch.batchNo}</td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">{it.quantity}</td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">{money(it.listPrice)}</td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">{money(it.unitPrice)}</td>
                                    <td className="py-1.5 text-right tabular-nums">{money(it.quantity * Number(it.unitPrice))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2">
                              <div className="text-xs text-slate-600">
                                <span className="font-medium">Attachments:</span>{' '}
                                {o.attachments.length === 0 && <span className="text-slate-400">none</span>}
                                {o.attachments.map((att) => (
                                  <button
                                    key={att.id}
                                    onClick={() => downloadAttachment(o.id, att.id, att.originalName)}
                                    className="ml-2 text-slate-900 underline underline-offset-2"
                                  >
                                    {att.originalName}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => { setUploadTarget(o.id); fileRef.current?.click(); }}
                                className="text-xs font-medium text-slate-900 underline underline-offset-2"
                              >
                                + Attach file
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
      )}
    </div>
  );
}
