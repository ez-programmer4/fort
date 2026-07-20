'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import {
  type CustomerRow, type CreditSummary, type Classification, type PaymentTerms,
  CLASSIFICATION_META, PAYMENT_TERMS_META, money, sortAutoTags,
} from '../shared';

interface PurchaseRow {
  id: number;
  dspNumber: string;
  createdAt: string;
  total: number;
  balanceDue: number;
  status: string;
}

interface PaymentRow {
  id: number;
  createdAt: string;
  dspNumber: string;
  method: string;
  reference: string | null;
  amount: number;
}

interface AuditRow {
  id: number;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  reason: string | null;
  createdAt: string;
  changedByName: string;
  changedByRole: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Company Name',
  contactPerson: 'Contact Person',
  phone: 'Phone',
  altPhone: 'Alternate Phone',
  email: 'Email',
  classification: 'Classification',
  tin: 'TIN Number',
  city: 'City',
  region: 'Region',
  country: 'Country',
  addressDetails: 'Street Address',
  paymentTerms: 'Payment Terms',
  withholdingTaxApplicable: 'Withholding Tax Applicable',
  creditLimit: 'Credit Limit',
  notes: 'Notes',
  tags: 'Buyer Tags',
  creditRating: 'Credit Rating',
  licenseNumber: 'License Number',
  isActive: 'Status',
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Account Created',
  UPDATE: 'Details Updated',
  ACTIVATE: 'Activated',
  DEACTIVATE: 'Deactivated',
};

function formatDiffValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (field === 'creditLimit') return money(Number(v));
  if (field === 'classification' && typeof v === 'string') return CLASSIFICATION_META[v as Classification] || v;
  if (field === 'paymentTerms' && typeof v === 'string') return PAYMENT_TERMS_META[v as PaymentTerms] || v;
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || '—'}</dd>
    </div>
  );
}

function Row({ label, value, emphasis, negative }: { label: string; value: string; emphasis?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`shrink-0 tabular-nums ${emphasis ? 'font-semibold' : 'font-medium'} ${negative ? 'text-red-600' : 'text-slate-900'}`}>
        {value}
      </dd>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<{ customer: CustomerRow }>(`/api/customers/${id}`),
      api<CreditSummary>(`/api/customers/${id}/credit-summary`),
      api<{ rows: PurchaseRow[] }>(`/api/customers/${id}/purchase-history`),
      api<{ rows: PaymentRow[] }>(`/api/customers/${id}/payment-history`),
      api<{ rows: AuditRow[] }>(`/api/customers/${id}/audit-log`),
    ])
      .then(([c, s, p, pay, audit]) => {
        setCustomer(c.customer);
        setSummary(s);
        setPurchases(p.rows);
        setPayments(pay.rows);
        setAuditRows(audit.rows);
        if (audit.rows.length > 0) setExpanded(new Set([audit.rows[0].id]));
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function toggleExpand(rowId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400">Loading…</div>;
  }
  if (!customer) {
    return <div className="py-16 text-center text-sm text-slate-400">Customer not found.</div>;
  }

  const statusLogRows = auditRows.filter((r) => r.action === 'ACTIVATE' || r.action === 'DEACTIVATE');
  const available = summary ? summary.creditLimit - summary.outstanding : 0;
  const wasUpdated = new Date(customer.updatedAt).getTime() - new Date(customer.createdAt).getTime() > 1000;

  return (
    <div>
      <Link href="/customers" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to Customers
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {[customer.city, customer.country || customer.region].filter(Boolean).join(', ') || 'Location not set'}
          </p>
        </div>
        <Link
          href={`/customers?edit=${customer.id}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Edit
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Company Profile</h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Contact Person" value={customer.contactPerson} />
              <Field label="TIN Number" value={customer.tin} />
              <Field label="Phone" value={customer.phone} />
              <Field label="Alternate Phone" value={customer.altPhone} />
              <Field label="Email" value={customer.email} />
              <Field
                label="Buyer Since"
                value={new Date(customer.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              />
              <Field label="Payment Terms" value={customer.paymentTerms ? PAYMENT_TERMS_META[customer.paymentTerms] : null} />
              <Field label="Withholding Tax" value={customer.withholdingTaxApplicable ? 'Applicable' : 'Not applicable'} />
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Street Address</dt>
                <dd className="mt-0.5 text-sm text-slate-900">{customer.addressDetails || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Customer Classification</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {customer.classification && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {CLASSIFICATION_META[customer.classification]}
                    </span>
                  )}
                  {customer.tags.map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {t}
                    </span>
                  ))}
                  {!customer.classification && customer.tags.length === 0 && (
                    <span className="text-sm text-slate-400">No classification tags</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {summary && summary.autoTags.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">System Insights</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sortAutoTags(summary.autoTags).map((t) => (
                  <span key={t} className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Purchase History</h2>
              <p className="text-xs text-slate-500">Recent invoices and orders</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Invoice</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Total Amount</th>
                    <th className="px-4 py-2.5 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        No purchase history found.
                      </td>
                    </tr>
                  )}
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{p.dspNumber}</td>
                      <td className="px-4 py-2.5 text-slate-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700'
                              : p.status === 'Partial'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{money(p.total)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{money(p.balanceDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Payment History</h2>
              <p className="text-xs text-slate-500">Payments recorded against this customer&rsquo;s invoices</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Invoice</th>
                    <th className="px-4 py-2.5">Method</th>
                    <th className="px-4 py-2.5">Reference</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        No payments recorded.
                      </td>
                    </tr>
                  )}
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 text-slate-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{p.dspNumber}</td>
                      <td className="px-4 py-2.5 text-slate-600">{p.method}</td>
                      <td className="px-4 py-2.5 text-slate-600">{p.reference || '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Status Audit Log</h2>
              <p className="text-xs text-slate-500">Every activation and deactivation, with who made the change and why</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Date &amp; Time</th>
                    <th className="px-4 py-2.5">Change</th>
                    <th className="px-4 py-2.5">Changed By</th>
                    <th className="px-4 py-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {statusLogRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                        No status changes recorded.
                      </td>
                    </tr>
                  )}
                  {statusLogRows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 text-slate-600">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.action === 'ACTIVATE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {r.action === 'ACTIVATE' ? 'Activated' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {r.changedByName}
                        {r.changedByRole ? ` · ${r.changedByRole}` : ''}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{r.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Account History</h2>
            <ol className="mt-3 space-y-4">
              {auditRows.length === 0 && <p className="text-sm text-slate-400">No history recorded.</p>}
              {auditRows.map((r, i) => {
                const fieldEntries = Object.entries(r.changes);
                const isExpanded = expanded.has(r.id);
                return (
                  <li key={r.id} className="border-l-2 border-slate-200 pl-4">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs font-semibold text-slate-400">{auditRows.length - i}</span>
                      <span className="text-sm font-medium text-slate-900">{ACTION_LABELS[r.action] || r.action}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}
                      {r.changedByName}
                      {r.changedByRole ? ` · ${r.changedByRole}` : ''}
                    </p>
                    {r.reason && <p className="mt-1 text-sm italic text-slate-600">&ldquo;{r.reason}&rdquo;</p>}
                    {fieldEntries.length > 0 && (
                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => toggleExpand(r.id)}
                          className="text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900"
                        >
                          {isExpanded ? 'Hide' : 'Show'} snapshot ({fieldEntries.length} field{fieldEntries.length === 1 ? '' : 's'} changed)
                        </button>
                        {isExpanded && (
                          <div className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                            {fieldEntries.map(([field, change]) => (
                              <div key={field} className="flex flex-wrap items-baseline gap-x-2">
                                <span className="text-xs font-medium text-slate-500">{FIELD_LABELS[field] || field}</span>
                                {r.action === 'CREATE' ? (
                                  <span className="text-slate-900">{formatDiffValue(field, change.to)}</span>
                                ) : (
                                  <span className="text-slate-900">
                                    {formatDiffValue(field, change.from)} <span className="text-slate-400">→</span>{' '}
                                    {formatDiffValue(field, change.to)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Credit Management</h2>
            {summary && (
              <dl className="mt-3 space-y-2.5 text-sm">
                <Row label="Outstanding Balance" value={`Br ${money(summary.outstanding)}`} emphasis={summary.outstanding > 0} />
                <Row label="Credit Limit" value={`Br ${money(summary.creditLimit)}`} />
                <Row label="Available Credit" value={`Br ${money(available)}`} emphasis negative={available < 0} />
                <Row label="Unpaid Invoices" value={String(summary.outstandingCount)} />
                <Row label="Last Payment" value={summary.lastPaymentAt ? new Date(summary.lastPaymentAt).toLocaleDateString() : '—'} />
                <Row label="Net Balance" value={`Br ${money(summary.outstanding)}`} />
              </dl>
            )}
            <Link href="/wallet" className="mt-4 block text-center text-xs font-medium text-slate-900 underline underline-offset-2">
              View Full Receivables Profile
            </Link>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Account Info</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Buyer ID" value={`#${customer.id}`} />
              <Row label="Status" value={customer.isActive ? 'Active' : 'Inactive'} />
              <Row label="Buyer Since" value={new Date(customer.createdAt).toLocaleDateString()} />
              <Row label="Last Updated" value={wasUpdated ? new Date(customer.updatedAt).toLocaleString() : '—'} />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
