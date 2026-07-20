// Shared between the Customers list page and the Customer detail page —
// kept in one place so the classification/rating/payment-terms vocabularies
// can't drift out of sync between the two.

export type Rating = 'UNRATED' | 'GOOD' | 'FAIR' | 'POOR';

export const RATING_META: Record<Rating, { label: string; badge: string }> = {
  UNRATED: { label: 'Unrated', badge: 'bg-slate-100 text-slate-600' },
  GOOD: { label: 'Good', badge: 'bg-emerald-50 text-emerald-700' },
  FAIR: { label: 'Fair', badge: 'bg-amber-50 text-amber-700' },
  POOR: { label: 'Poor', badge: 'bg-red-50 text-red-700' },
};
export const RATING_OPTIONS = (Object.keys(RATING_META) as Rating[]).map((r) => ({ value: r, label: RATING_META[r].label }));

export type Classification = 'PHARMACY' | 'HOSPITAL' | 'CLINIC' | 'WHOLESALE' | 'NGO' | 'PRIMARY_HEALTHCARE' | 'GOVERNMENT';

export const CLASSIFICATION_META: Record<Classification, string> = {
  PHARMACY: 'Pharmacy',
  HOSPITAL: 'Hospital',
  CLINIC: 'Clinic',
  WHOLESALE: 'Wholesale',
  NGO: 'NGO',
  PRIMARY_HEALTHCARE: 'Primary Healthcare Centre',
  GOVERNMENT: 'Government Institution',
};
export const CLASSIFICATION_OPTIONS = (Object.keys(CLASSIFICATION_META) as Classification[]).map((c) => ({
  value: c,
  label: CLASSIFICATION_META[c],
}));

export type PaymentTerms = 'CASH' | 'NET_15' | 'NET_30' | 'NET_60' | 'DUE_ON_RECEIPT';

export const PAYMENT_TERMS_META: Record<PaymentTerms, string> = {
  CASH: 'Cash',
  NET_15: 'Net 15',
  NET_30: 'Net 30',
  NET_60: 'Net 60',
  DUE_ON_RECEIPT: 'Due on Receipt',
};
export const PAYMENT_TERMS_OPTIONS = (Object.keys(PAYMENT_TERMS_META) as PaymentTerms[]).map((p) => ({
  value: p,
  label: PAYMENT_TERMS_META[p],
}));

// Manually assignable buyer tags. "New Buyer" / "High Volume" / "Cash Buyer"
// are NOT in this list — they're auto-detected from order history (see
// CreditSummary.autoTags) and shown read-only, never manually toggled.
export const SUGGESTED_TAGS = [
  'Hospital', 'Pharmacy', 'Distributor', 'Government Buyer', 'Wholesale Buyer', 'Retail Buyer', 'VIP Buyer',
];

export function money(v: number) {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface BankAccount {
  bankName: string;
  accountNumber: string;
}

export interface LicenseDocument {
  storedName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface CustomerRow {
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
  country: string | null;
  addressDetails: string | null;
  paymentTerms: PaymentTerms | null;
  withholdingTaxApplicable: boolean;
  creditLimit: number;
  notes: string | null;
  tags: string[];
  bankAccounts: BankAccount[];
  creditRating: Rating;
  licenseNumber: string | null;
  licenseDocument: LicenseDocument | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { dispenseOrders: number };
}

export interface CreditSummary {
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
  lastPaymentAt: string | null;
  autoTags: string[];
}

// "New Buyer" ranks first in insight lists — it's the most immediately
// actionable ("this is someone's first purchase window") — followed by the
// others in a stable, deliberate order rather than API response order.
export const AUTO_TAG_ORDER = ['New Buyer', 'High Volume', 'Cash Buyer'];

export function sortAutoTags(tags: string[]) {
  return [...tags].sort((a, b) => AUTO_TAG_ORDER.indexOf(a) - AUTO_TAG_ORDER.indexOf(b));
}
