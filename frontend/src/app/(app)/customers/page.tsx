'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getTokens } from '@/lib/api';
import { Drawer } from '@/components/ui/drawer';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SkeletonRows } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { SortableHeader, useSort } from '@/components/ui/sortable-header';
import { Select } from '@/components/ui/select';

const input =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';

type Rating = 'UNRATED' | 'GOOD' | 'FAIR' | 'POOR';

const RATING_META: Record<Rating, { label: string; badge: string }> = {
  UNRATED: { label: 'Unrated', badge: 'bg-slate-100 text-slate-600' },
  GOOD: { label: 'Good', badge: 'bg-emerald-50 text-emerald-700' },
  FAIR: { label: 'Fair', badge: 'bg-amber-50 text-amber-700' },
  POOR: { label: 'Poor', badge: 'bg-red-50 text-red-700' },
};
const RATING_OPTIONS = (Object.keys(RATING_META) as Rating[]).map((r) => ({ value: r, label: RATING_META[r].label }));

type Classification = 'PHARMACY' | 'HOSPITAL' | 'CLINIC' | 'WHOLESALE' | 'NGO' | 'PRIMARY_HEALTHCARE' | 'GOVERNMENT';

const CLASSIFICATION_META: Record<Classification, string> = {
  PHARMACY: 'Pharmacy',
  HOSPITAL: 'Hospital',
  CLINIC: 'Clinic',
  WHOLESALE: 'Wholesale',
  NGO: 'NGO',
  PRIMARY_HEALTHCARE: 'Primary Healthcare Centre',
  GOVERNMENT: 'Government Institution',
};
const CLASSIFICATION_OPTIONS = (Object.keys(CLASSIFICATION_META) as Classification[]).map((c) => ({
  value: c,
  label: CLASSIFICATION_META[c],
}));

// Manually assignable buyer tags. "High Volume" / "Cash Buyer" are NOT in
// this list — they're auto-detected from order history (see CreditSummary
// .autoTags) and shown read-only, never manually toggled.
const SUGGESTED_TAGS = [
  'Hospital', 'Pharmacy', 'Distributor', 'Government Buyer', 'Wholesale Buyer', 'Retail Buyer', 'VIP Buyer',
];

function money(v: number) {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface BankAccount {
  bankName: string;
  accountNumber: string;
}

interface LicenseDocument {
  storedName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

interface CustomerRow {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  classification: Classification | null;
  tin: string | null;
  city: string | null;
  region: string | null;
  addressDetails: string | null;
  creditLimit: number;
  notes: string | null;
  tags: string[];
  bankAccounts: BankAccount[];
  creditRating: Rating;
  licenseNumber: string | null;
  licenseDocument: LicenseDocument | null;
  isActive: boolean;
  createdAt: string;
  _count?: { dispenseOrders: number };
}

interface FormState {
  id: number | null;
  name: string;
  contactPerson: string;
  phone: string;
  altPhone: string;
  email: string;
  classification: Classification | '';
  tin: string;
  city: string;
  region: string;
  addressDetails: string;
  creditLimit: string;
  notes: string;
  tags: string[];
  bankAccounts: BankAccount[];
  creditRating: Rating;
  licenseNumber: string;
}

interface CreditSummary {
  creditRating: Rating;
  creditLimit: number;
  totalOrders: number;
  creditOrderCount: number;
  settledCount: number;
  outstandingCount: number;
  totalCreditAmount: number;
  totalPaid: number;
  outstanding: number;
  lastOrderAt: string | null;
  autoTags: string[];
}

const emptyForm: FormState = {
  id: null,
  name: '',
  contactPerson: '',
  phone: '',
  altPhone: '',
  email: '',
  classification: '',
  tin: '',
  city: '',
  region: '',
  addressDetails: '',
  creditLimit: '',
  notes: '',
  tags: [],
  bankAccounts: [],
  creditRating: 'UNRATED',
  licenseNumber: '',
};

export default function CustomersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRow, setConfirmRow] = useState<CustomerRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const licenseFileRef = useRef<HTMLInputElement>(null);
  const { sortBy, sortDir, toggle } = useSort('name');
  const currentRow = form?.id != null ? rows.find((r) => r.id === form.id) || null : null;

  const load = useCallback(async (search: string, classif: string, pageNum: number, size: number, sBy: string, sDir: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(size), sortBy: sBy, sortDir: sDir });
      if (search) params.set('q', search);
      if (classif) params.set('classification', classif);
      const d = await api<{ customers: CustomerRow[]; total: number }>(`/api/customers?${params}`);
      setRows(d.customers);
      setTotal(d.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(q, classificationFilter, page, pageSize, sortBy, sortDir).catch((e) => toast.error(e.message));
  }, [q, classificationFilter, page, pageSize, sortBy, sortDir, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep links from the command palette: ?q=<term> pre-fills the search,
  // ?new=1 opens the Add Customer drawer.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    if (qParam) setQ(qParam);
    if (params.get('new') === '1') setForm(emptyForm);
  }, []);

  // Payment-history summary — the data staff use to decide what to set the
  // rating to. Only exists for an existing customer, not while creating one.
  useEffect(() => {
    if (!form?.id) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    api<CreditSummary>(`/api/customers/${form.id}/credit-summary`)
      .then(setSummary)
      .catch((e) => toast.error(e.message))
      .finally(() => setSummaryLoading(false));
  }, [form?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: form.name,
        contactPerson: form.contactPerson || null,
        phone: form.phone || null,
        altPhone: form.altPhone || null,
        email: form.email || null,
        classification: form.classification || null,
        tin: form.tin || null,
        city: form.city || null,
        region: form.region || null,
        addressDetails: form.addressDetails || null,
        creditLimit: form.creditLimit === '' ? 0 : Number(form.creditLimit),
        notes: form.notes || null,
        tags: form.tags,
        bankAccounts: form.bankAccounts,
        creditRating: form.creditRating,
        licenseNumber: form.licenseNumber || null,
      });
      if (form.id === null) {
        await api('/api/customers', { method: 'POST', body });
        toast.success(`Customer "${form.name}" created.`);
      } else {
        await api(`/api/customers/${form.id}`, { method: 'PATCH', body });
        toast.success(`Customer "${form.name}" updated.`);
      }
      setForm(null);
      await load(q, classificationFilter, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onUploadLicense(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || form?.id == null) return;
    setUploadingLicense(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api(`/api/customers/${form.id}/license`, { method: 'POST', body: fd });
      toast.success(`"${file.name}" uploaded.`);
      await load(q, classificationFilter, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      if (licenseFileRef.current) licenseFileRef.current.value = '';
      setUploadingLicense(false);
    }
  }

  async function downloadLicense() {
    if (form?.id == null) return;
    try {
      const res = await fetch(`/api/customers/${form.id}/license`, {
        headers: { Authorization: `Bearer ${getTokens()?.accessToken}` },
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentRow?.licenseDocument?.originalName || 'license';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  }

  async function toggleActive(row: CustomerRow) {
    try {
      await api(`/api/customers/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      toast.success(`"${row.name}" ${row.isActive ? 'deactivated' : 'activated'}.`);
      await load(q, classificationFilter, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  function setBank(i: number, patch: Partial<BankAccount>) {
    if (!form) return;
    const next = form.bankAccounts.map((b, idx) => (idx === i ? { ...b, ...patch } : b));
    setForm({ ...form, bankAccounts: next });
  }

  function toggleTag(tag: string) {
    if (!form) return;
    setForm({
      ...form,
      tags: form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag],
    });
  }

  function addCustomTag() {
    if (!form) return;
    const t = customTag.trim();
    if (!t || form.tags.includes(t)) {
      setCustomTag('');
      return;
    }
    setForm({ ...form, tags: [...form.tags, t] });
    setCustomTag('');
  }

  async function remove() {
    if (!confirmRow) return;
    setConfirmBusy(true);
    try {
      await api(`/api/customers/${confirmRow.id}`, { method: 'DELETE' });
      toast.success(`Customer "${confirmRow.name}" deleted.`);
      setConfirmRow(null);
      await load(q, classificationFilter, page, pageSize, sortBy, sortDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setConfirmRow(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            People and organizations you dispense to — created here or quick-added during a sale.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            onSearch={(term) => {
              setQ(term);
              setPage(1);
            }}
            placeholder="Search name, contact, phone, email…"
            className="w-64"
            initialValue={q}
          />
          <Select
            value={classificationFilter}
            onChange={(v) => {
              setClassificationFilter(v);
              setPage(1);
            }}
            placeholder="All classifications"
            options={[{ value: '', label: 'All classifications' }, ...CLASSIFICATION_OPTIONS]}
            className="w-48"
          />
          <button
            onClick={() => setForm(emptyForm)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Add Customer
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortableHeader label="Company" sortKey="name" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <th className="px-4 py-3">Classification</th>
              <SortableHeader label="Phone" sortKey="phone" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3 text-right">Orders</th>
              <SortableHeader label="Added" sortKey="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={toggle} />
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={5} cols={10} />}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <EmptyState
                    title={q || classificationFilter ? 'No customers match your search' : 'No customers yet'}
                    description={
                      q || classificationFilter
                        ? 'Try a different name, phone, email, or classification.'
                        : 'Customers are usually added inline while dispensing — or add one here.'
                    }
                    action={q || classificationFilter ? undefined : { label: '+ Add Customer', onClick: () => setForm(emptyForm) }}
                  />
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{row.name}</span>
                    {row.email && <p className="text-xs text-slate-400">{row.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.classification ? CLASSIFICATION_META[row.classification] : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.contactPerson || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.city || row.region ? [row.city, row.region].filter(Boolean).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RATING_META[row.creditRating].badge}`}>
                      {RATING_META[row.creditRating].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{row._count?.dispenseOrders ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</td>
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
                      onClick={() =>
                        setForm({
                          id: row.id,
                          name: row.name,
                          contactPerson: row.contactPerson || '',
                          phone: row.phone || '',
                          altPhone: row.altPhone || '',
                          email: row.email || '',
                          classification: row.classification || '',
                          tin: row.tin || '',
                          city: row.city || '',
                          region: row.region || '',
                          addressDetails: row.addressDetails || '',
                          creditLimit: row.creditLimit ? String(row.creditLimit) : '',
                          notes: row.notes || '',
                          tags: row.tags || [],
                          bankAccounts: row.bankAccounts || [],
                          creditRating: row.creditRating,
                          licenseNumber: row.licenseNumber || '',
                        })
                      }
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
                    <button
                      onClick={() => setConfirmRow(row)}
                      className="ml-3 text-xs font-medium text-red-600 hover:underline"
                    >
                      Delete
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
        title={form?.id == null ? 'Add Customer' : 'Edit Customer'}
        subtitle="Company, contact, and classification details for dispensing and sales history"
        width="lg"
      >
        {form && (
          <form onSubmit={save} className="space-y-4" noValidate>
            <div>
              <label className={label}>Company Name *</label>
              <input required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Contact Person *</label>
                <input required value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Classification</label>
                <Select
                  value={form.classification}
                  onChange={(v) => setForm({ ...form, classification: v as Classification })}
                  placeholder="Select…"
                  options={CLASSIFICATION_OPTIONS}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Phone *</label>
                <input required value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>Alternate Phone</label>
                <input value={form.altPhone}
                  onChange={(e) => setForm({ ...form, altPhone: e.target.value })} className={input} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Email</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
              </div>
              <div>
                <label className={label}>TIN</label>
                <input value={form.tin}
                  onChange={(e) => setForm({ ...form, tin: e.target.value })} className={input} />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <label className={label}>Location</label>
              <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-500">City *</label>
                  <input required value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })} className={input} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Region *</label>
                  <input required value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })} className={input} />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs text-slate-500">Additional address details</label>
                <textarea rows={2} value={form.addressDetails}
                  placeholder="Sub-city, woreda, landmark, building…"
                  onChange={(e) => setForm({ ...form, addressDetails: e.target.value })}
                  className={`${input} resize-none`} />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <label className={label}>Credit limit</label>
              <input type="number" min="0" step="0.01" value={form.creditLimit}
                placeholder="0.00"
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                className={`${input} max-w-48`} />
              <p className="mt-1 text-[11px] text-slate-400">
                Advisory only — shown alongside outstanding balance in Sales when this customer buys on credit.
              </p>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <label className={label}>Buyer tags</label>
                {form.id !== null && summary && summary.autoTags.length > 0 && (
                  <div className="flex gap-1">
                    {summary.autoTags.map((t) => (
                      <span key={t} className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Classify what this customer is. Behavioral tags like "High Volume" or "Cash Buyer" (shown above, if any) are detected automatically.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTED_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      form.tags.includes(t)
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {form.tags
                  .filter((t) => !SUGGESTED_TAGS.includes(t))
                  .map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className="flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                    >
                      {t}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  placeholder="Add a custom tag…"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
                />
                <button type="button" onClick={addCustomTag} className="text-xs font-medium text-slate-900 underline underline-offset-2">
                  Add
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <label className={label}>Additional notes</label>
              <textarea rows={3} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={`${input} resize-none`} />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <label className={label}>Bank accounts</label>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      bankAccounts: [...form.bankAccounts, { bankName: '', accountNumber: '' }],
                    })
                  }
                  className="text-xs font-medium text-slate-900 underline underline-offset-2"
                >
                  + Add bank account
                </button>
              </div>
              {form.bankAccounts.map((b, i) => (
                <div key={i} className="mt-2 flex items-center gap-2">
                  <input
                    placeholder="Bank name"
                    value={b.bankName}
                    onChange={(e) => setBank(i, { bankName: e.target.value })}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                  />
                  <input
                    placeholder="Account number"
                    value={b.accountNumber}
                    onChange={(e) => setBank(i, { accountNumber: e.target.value })}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        bankAccounts: form.bankAccounts.filter((_, idx) => idx !== i),
                      })
                    }
                    className="shrink-0 text-xs text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <label className={label}>Business license</label>
              <input
                placeholder="License number"
                value={form.licenseNumber}
                onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                className={input}
              />
              {form.id === null ? (
                <p className="mt-2 text-[11px] text-slate-400">Save the customer first to upload a license document.</p>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  {currentRow?.licenseDocument ? (
                    <button
                      type="button"
                      onClick={downloadLicense}
                      className="flex min-w-0 items-center gap-1.5 text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900"
                    >
                      <span className="truncate">{currentRow.licenseDocument.originalName}</span>
                    </button>
                  ) : (
                    <p className="text-sm text-slate-400">No document on file.</p>
                  )}
                  <button
                    type="button"
                    disabled={uploadingLicense}
                    onClick={() => licenseFileRef.current?.click()}
                    className="ml-auto shrink-0 text-xs font-medium text-slate-900 underline underline-offset-2 disabled:opacity-50"
                  >
                    {uploadingLicense ? 'Uploading…' : currentRow?.licenseDocument ? 'Replace' : '+ Upload'}
                  </button>
                  <input ref={licenseFileRef} type="file" onChange={onUploadLicense} className="hidden" />
                </div>
              )}
            </div>

            {form.id !== null && (
              <div className="border-t border-slate-200 pt-4">
                <label className={label}>Payment history</label>
                {summaryLoading && (
                  <div className="mt-2 h-16 animate-pulse rounded-md bg-slate-100" />
                )}
                {!summaryLoading && summary && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p><span className="text-slate-500">Credit sales:</span> <span className="text-slate-900">{summary.creditOrderCount}</span></p>
                    <p><span className="text-slate-500">Fully settled:</span> <span className="text-slate-900">{summary.settledCount}</span></p>
                    <p><span className="text-slate-500">Total extended:</span> <span className="tabular-nums text-slate-900">{money(summary.totalCreditAmount)}</span></p>
                    <p><span className="text-slate-500">Total paid:</span> <span className="tabular-nums text-slate-900">{money(summary.totalPaid)}</span></p>
                    <p className="col-span-2">
                      <span className="text-slate-500">Outstanding now:</span>{' '}
                      <span className={`tabular-nums font-semibold ${summary.outstanding > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {money(summary.outstanding)}
                      </span>
                      {Number(form.creditLimit) > 0 && (
                        <span className="ml-1 text-xs text-slate-400">
                          of {money(Number(form.creditLimit))} limit
                          {summary.outstanding > Number(form.creditLimit) && (
                            <span className="ml-1 font-medium text-red-600">— over limit</span>
                          )}
                        </span>
                      )}
                    </p>
                    {summary.lastOrderAt && (
                      <p className="col-span-2 text-xs text-slate-400">
                        Last order {new Date(summary.lastOrderAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-400">Use this history to decide the rating below.</p>
                <div className="mt-3">
                  <label className={label}>Credit rating</label>
                  <Select
                    value={form.creditRating}
                    onChange={(v) => setForm({ ...form, creditRating: v as Rating })}
                    options={RATING_OPTIONS}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
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

      <ConfirmDialog
        open={confirmRow !== null}
        title="Delete customer?"
        message={
          <>
            <span className="font-medium text-slate-900">{confirmRow?.name}</span> will be permanently
            deleted. Customers with sales history cannot be deleted — deactivate them instead.
          </>
        }
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onConfirm={remove}
        onCancel={() => setConfirmRow(null)}
      />
    </div>
  );
}
