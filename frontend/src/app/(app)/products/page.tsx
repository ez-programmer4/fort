'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiDownload } from '@/lib/api';
import { Drawer } from '@/components/ui/drawer';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Combobox } from '@/components/ui/combobox';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';

const TYPES = ['Medication', 'Equipment', 'Cosmetics'];

interface SupplierOption {
  id: number;
  name: string;
}

interface ProductRow {
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
  orderUnit: string | null;
  dispenseUnit: string | null;
  conversionFactor: number;
  countryOfOrigin: string | null;
  manufacturer: string | null;
  unitPrice: string;
  minStock: number | null;
  maxStock: number | null;
  expiryAlertDays: number | null;
  isActive: boolean;
  supplier: SupplierOption | null;
}

interface Lookups {
  doseForm?: string[];
  route?: string[];
  doseUnit?: string[];
  unit?: string[];
}

interface FormState {
  id: number | null;
  type: string;
  pharmClass: string;
  genericName: string;
  brandName: string;
  description: string;
  strength: string;
  doseUnit: string;
  route: string;
  doseForm: string;
  orderUnit: string;
  dispenseUnit: string;
  conversionFactor: string;
  countryOfOrigin: string;
  manufacturer: string;
  supplierId: string;
  unitPrice: string;
  minStock: string;
  maxStock: string;
  expiryAlertDays: string;
}

const emptyForm: FormState = {
  id: null,
  type: 'Medication',
  pharmClass: '',
  genericName: '',
  brandName: '',
  description: '',
  strength: '',
  doseUnit: '',
  route: '',
  doseForm: '',
  orderUnit: '',
  dispenseUnit: '',
  conversionFactor: '1',
  countryOfOrigin: '',
  manufacturer: '',
  supplierId: '',
  unitPrice: '0',
  minStock: '',
  maxStock: '',
  expiryAlertDays: '',
};

export default function ProductsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [lookups, setLookups] = useState<Lookups>({});
  const [form, setForm] = useState<FormState | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (search: string, type: string, pageNum: number, size: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (type) params.set('type', type);
      params.set('page', String(pageNum));
      params.set('pageSize', String(size));
      const data = await api<{ products: ProductRow[]; total: number }>(`/api/products?${params}`);
      setRows(data.products);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api<{ suppliers: SupplierOption[] }>('/api/suppliers'),
      api<{ lookups: Lookups }>('/api/lookups'),
    ])
      .then(([s, l]) => {
        setSuppliers(s.suppliers);
        setLookups(l.lookups);
      })
      .catch((e) => toast.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load(q, typeFilter, page, pageSize).catch((e) => toast.error(e.message));
  }, [q, typeFilter, page, pageSize, load]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const body = JSON.stringify({
        type: form.type,
        pharmClass: form.pharmClass,
        genericName: form.genericName,
        brandName: form.brandName || null,
        description: form.description || null,
        strength: form.strength || null,
        doseUnit: form.doseUnit || null,
        route: form.route || null,
        doseForm: form.doseForm || null,
        orderUnit: form.orderUnit || null,
        dispenseUnit: form.dispenseUnit || null,
        conversionFactor: Number(form.conversionFactor) || 1,
        countryOfOrigin: form.countryOfOrigin || null,
        manufacturer: form.manufacturer || null,
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        unitPrice: Number(form.unitPrice) || 0,
        minStock: form.minStock === '' ? null : Number(form.minStock),
        maxStock: form.maxStock === '' ? null : Number(form.maxStock),
        expiryAlertDays: form.expiryAlertDays === '' ? null : Number(form.expiryAlertDays),
      });
      if (form.id === null) {
        await api('/api/products', { method: 'POST', body });
        toast.success(`Product "${form.genericName}" created.`);
      } else {
        await api(`/api/products/${form.id}`, { method: 'PATCH', body });
        toast.success(`Product "${form.genericName}" updated.`);
      }
      setForm(null);
      await load(q, typeFilter, page, pageSize);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: ProductRow) {
    try {
      await api(`/api/products/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      toast.success(`"${row.genericName}" ${row.isActive ? 'deactivated' : 'activated'}.`);
      await load(q, typeFilter, page, pageSize);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice('');
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await api<{ created: number; errors: { row: number; message: string }[] }>(
        '/api/products/import',
        { method: 'POST', body: fd },
      );
      toast.success(`Imported ${result.created} product(s).`);
      if (result.errors.length) {
        setNotice(
          `${result.errors.length} row(s) skipped: ${result.errors
            .slice(0, 5)
            .map((er) => `row ${er.row} — ${er.message}`)
            .join('; ')}${result.errors.length > 5 ? '…' : ''}`,
        );
      }
      setPage(1);
      await load(q, typeFilter, 1, pageSize);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function exportNow() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (typeFilter) params.set('type', typeFilter);
    apiDownload(`/api/products/export?${params}`, 'products-export.xlsx').catch((e) =>
      toast.error(e.message),
    );
  }

  function edit(row: ProductRow) {
    setForm({
      id: row.id,
      type: row.type,
      pharmClass: row.pharmClass,
      genericName: row.genericName,
      brandName: row.brandName || '',
      description: row.description || '',
      strength: row.strength || '',
      doseUnit: row.doseUnit || '',
      route: row.route || '',
      doseForm: row.doseForm || '',
      orderUnit: row.orderUnit || '',
      dispenseUnit: row.dispenseUnit || '',
      conversionFactor: String(row.conversionFactor),
      countryOfOrigin: row.countryOfOrigin || '',
      manufacturer: row.manufacturer || '',
      supplierId: row.supplier ? String(row.supplier.id) : '',
      unitPrice: String(row.unitPrice),
      minStock: row.minStock != null ? String(row.minStock) : '',
      maxStock: row.maxStock != null ? String(row.maxStock) : '',
      expiryAlertDays: row.expiryAlertDays != null ? String(row.expiryAlertDays) : '',
    });
  }

  const input =
    'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
  const label = 'block text-xs font-medium text-slate-600';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} product(s) — medications, equipment and cosmetics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => apiDownload('/api/products/template', 'products-template.xlsx').catch((e) => toast.error(e.message))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Template
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" onChange={onImport} className="hidden" />
          <button
            onClick={exportNow}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Export
          </button>
          <button
            onClick={() => setForm(emptyForm)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Add Product
          </button>
        </div>
      </div>

      {notice && (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {notice}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SearchInput
          onSearch={(term) => {
            setQ(term);
            setPage(1);
          }}
          placeholder="Search code, name, brand, class…"
          className="w-72"
        />
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
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
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Form</th>
              <th className="px-4 py-3">Strength</th>
              <th className="px-4 py-3 text-right">Unit Price</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={8} cols={11} />}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <EmptyState
                    title={q || typeFilter ? 'No products match your filters' : 'No products yet'}
                    description={
                      q || typeFilter
                        ? 'Try a different search term or type.'
                        : 'Add a product manually or import an Excel file to get started.'
                    }
                    action={
                      q || typeFilter ? undefined : { label: '+ Add Product', onClick: () => setForm(emptyForm) }
                    }
                  />
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.genericName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.brandName || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.pharmClass}</td>
                  <td className="px-4 py-3 text-slate-600">{row.doseForm || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.strength ? `${row.strength} ${row.doseUnit || ''}`.trim() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                    {Number(row.unitPrice).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.supplier?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {row.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => edit(row)}
                      className="text-xs font-medium text-slate-900 underline underline-offset-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(row)}
                      className="ml-3 text-xs font-medium text-slate-500 hover:underline"
                    >
                      {row.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
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

      <Drawer
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id == null ? 'Add Product' : 'Edit Product'}
        subtitle="Product identity, units, pricing and alert thresholds"
        width="xl"
      >
        {form && (
          <form onSubmit={save}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className={input}
                >
                  {TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Pharmacotherapeutic Class *</label>
                <input
                  required
                  value={form.pharmClass}
                  onChange={(e) => setForm({ ...form, pharmClass: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Generic Name *</label>
                <input
                  required
                  value={form.genericName}
                  onChange={(e) => setForm({ ...form, genericName: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Brand Name</label>
                <input
                  value={form.brandName}
                  onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  className={input}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Strength/Dose</label>
                <input
                  value={form.strength}
                  onChange={(e) => setForm({ ...form, strength: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Dose Unit</label>
                <select
                  value={form.doseUnit}
                  onChange={(e) => setForm({ ...form, doseUnit: e.target.value })}
                  className={input}
                >
                  <option value="">—</option>
                  {(lookups.doseUnit || []).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Route</label>
                <select
                  value={form.route}
                  onChange={(e) => setForm({ ...form, route: e.target.value })}
                  className={input}
                >
                  <option value="">—</option>
                  {(lookups.route || []).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Dose Form</label>
                <select
                  value={form.doseForm}
                  onChange={(e) => setForm({ ...form, doseForm: e.target.value })}
                  className={input}
                >
                  <option value="">—</option>
                  {(lookups.doseForm || []).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Order Unit</label>
                <select
                  value={form.orderUnit}
                  onChange={(e) => setForm({ ...form, orderUnit: e.target.value })}
                  className={input}
                >
                  <option value="">—</option>
                  {(lookups.unit || []).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Dispense Unit</label>
                <select
                  value={form.dispenseUnit}
                  onChange={(e) => setForm({ ...form, dispenseUnit: e.target.value })}
                  className={input}
                >
                  <option value="">—</option>
                  {(lookups.unit || []).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Conversion Factor</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={form.conversionFactor}
                  onChange={(e) => setForm({ ...form, conversionFactor: e.target.value })}
                  className={input}
                />
                <p className="mt-0.5 text-[11px] text-slate-400">Dispense units per order unit</p>
              </div>
              <div>
                <label className={label}>Country of Origin</label>
                <input
                  value={form.countryOfOrigin}
                  onChange={(e) => setForm({ ...form, countryOfOrigin: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Manufacturer</label>
                <input
                  value={form.manufacturer}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Supplier</label>
                <Combobox
                  options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
                  value={form.supplierId}
                  onChange={(v) => setForm({ ...form, supplierId: v })}
                  placeholder="Search supplier…"
                  className="mt-1"
                />
              </div>
              <div>
                <label className={label}>Unit Price *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                  className={input}
                />
              </div>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Alert thresholds (in dispense unit)
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={label}>
                    Min Stock {form.dispenseUnit ? `(${form.dispenseUnit})` : ''}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                    placeholder="no low-stock alert"
                    className={input}
                  />
                  <p className="mt-0.5 text-[11px] text-slate-400">Low-stock alert below this</p>
                </div>
                <div>
                  <label className={label}>
                    Max Stock {form.dispenseUnit ? `(${form.dispenseUnit})` : ''}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.maxStock}
                    onChange={(e) => setForm({ ...form, maxStock: e.target.value })}
                    placeholder="no over-stock alert"
                    className={input}
                  />
                  <p className="mt-0.5 text-[11px] text-slate-400">Over-stock alert above this</p>
                </div>
                <div>
                  <label className={label}>Expiry Alert (days)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.expiryAlertDays}
                    onChange={(e) => setForm({ ...form, expiryAlertDays: e.target.value })}
                    placeholder="default 90"
                    className={input}
                  />
                  <p className="mt-0.5 text-[11px] text-slate-400">Alert this many days before expiry</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
