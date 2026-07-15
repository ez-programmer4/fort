'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppSettings, fetchSettings, invalidateSettings } from '@/lib/settings';

const input =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const label = 'block text-xs font-medium text-slate-600';

export default function SettingsPage() {
  const [form, setForm] = useState<AppSettings | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings(true)
      .then(setForm)
      .catch((e) => setError(e.message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify(form) });
      invalidateSettings();
      setNotice('Settings saved. New PDFs, slips and alerts will use them immediately.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return <p className="text-sm text-slate-400">{error || 'Loading…'}</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Pharmacy identity (used on reports and dispense slips) and system defaults.
      </p>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{notice}</p>
      )}

      <form onSubmit={save} className="mt-6 space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Pharmacy Identity</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={label}>Pharmacy name *</label>
              <input required value={form.pharmacyName}
                onChange={(e) => setForm({ ...form, pharmacyName: e.target.value })}
                className={`mt-1 w-full ${input}`} />
            </div>
            <div>
              <label className={label}>Logo initials (1–2 letters)</label>
              <input maxLength={2} value={form.logoInitial}
                onChange={(e) => setForm({ ...form, logoInitial: e.target.value })}
                className={`mt-1 w-24 ${input}`} />
              <p className="mt-0.5 text-[11px] text-slate-400">Shown in the black logo box on PDFs</p>
            </div>
            <div>
              <label className={label}>Address</label>
              <input value={form.pharmacyAddress}
                onChange={(e) => setForm({ ...form, pharmacyAddress: e.target.value })}
                className={`mt-1 w-full ${input}`} />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input value={form.pharmacyPhone}
                onChange={(e) => setForm({ ...form, pharmacyPhone: e.target.value })}
                className={`mt-1 w-full ${input}`} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Defaults</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className={label}>Expiry alert window (days)</label>
              <input type="number" min="0" step="1" value={form.defaultExpiryAlertDays}
                onChange={(e) => setForm({ ...form, defaultExpiryAlertDays: Number(e.target.value) })}
                className={`mt-1 w-full ${input}`} />
              <p className="mt-0.5 text-[11px] text-slate-400">Used when a product has no own window</p>
            </div>
            <div>
              <label className={label}>Default WHT — goods (%)</label>
              <input type="number" min="0" max="100" step="0.01" value={form.whtGoodsRate}
                onChange={(e) => setForm({ ...form, whtGoodsRate: Number(e.target.value) })}
                className={`mt-1 w-full ${input}`} />
            </div>
            <div>
              <label className={label}>Default WHT — services (%)</label>
              <input type="number" min="0" max="100" step="0.01" value={form.whtServicesRate}
                onChange={(e) => setForm({ ...form, whtServicesRate: Number(e.target.value) })}
                className={`mt-1 w-full ${input}`} />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
