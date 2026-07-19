'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Icon, IconName } from '@/components/icons';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  permission: string;
}

interface ActionItem {
  label: string;
  href: string;
  permission: string;
  icon: IconName;
}

const ACTIONS: ActionItem[] = [
  { label: 'New Sale', href: '/sales', permission: 'sales.dispense', icon: 'cart' },
  { label: 'New Purchase Order', href: '/procurement?new=1', permission: 'procurement.manage', icon: 'truck' },
  { label: 'New Customer', href: '/customers?new=1', permission: 'customers.manage', icon: 'heart' },
  { label: 'New Supplier', href: '/suppliers?new=1', permission: 'suppliers.manage', icon: 'users' },
  { label: 'New Product', href: '/products?new=1', permission: 'products.manage', icon: 'box' },
];

interface ResultRow {
  key: string;
  icon: IconName;
  group: string;
  label: string;
  sublabel?: string;
  onSelect: () => void;
}

const CommandPaletteContext = createContext<{ open: () => void } | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  return ctx;
}

/** Header button that opens the palette — a separate component so it can
 *  consume the context the provider it's nested inside supplies. */
export function SearchTrigger() {
  const { open } = useCommandPalette();
  return (
    <button
      onClick={open}
      className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:border-slate-300 hover:text-slate-900"
    >
      <Icon name="search" className="h-4 w-4" />
      <span className="hidden sm:inline">Search…</span>
      <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
        Ctrl K
      </kbd>
    </button>
  );
}

export function CommandPaletteProvider({ nav, children }: { nav: NavItem[]; children: React.ReactNode }) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [records, setRecords] = useState<ResultRow[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setTerm('');
    setRecords([]);
  }, []);

  const openPalette = useCallback(() => setIsOpen(true), []);

  // Global Ctrl/Cmd+K shortcut — works from anywhere in the app, not just
  // when the search field itself has focus.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((o) => !o);
      } else if (e.key === 'Escape' && isOpen) {
        close();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  function go(href: string) {
    close();
    router.push(href);
  }

  // Debounced live search across the record types staff look up most —
  // fanned out to the existing list endpoints rather than a new unified
  // search endpoint, since each already supports `?q=`.
  useEffect(() => {
    const q = term.trim();
    if (!isOpen || q.length < 2) {
      setRecords([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const [products, customers, suppliers, sales] = await Promise.all([
          api<{ products: { id: number; code: string; genericName: string; brandName: string | null }[] }>(
            `/api/products?q=${encodeURIComponent(q)}&pageSize=5`,
          ).catch(() => ({ products: [] })),
          api<{ customers: { id: number; name: string; phone: string | null }[] }>(
            `/api/customers?q=${encodeURIComponent(q)}&page=1&pageSize=5`,
          ).catch(() => ({ customers: [] })),
          api<{ suppliers: { id: number; name: string; tin: string | null }[] }>(
            `/api/suppliers?q=${encodeURIComponent(q)}&page=1&pageSize=5`,
          ).catch(() => ({ suppliers: [] })),
          api<{ orders: { id: number; dspNumber: string; customer: { name: string } | null }[] }>(
            `/api/sales?q=${encodeURIComponent(q)}&pageSize=5`,
          ).catch(() => ({ orders: [] })),
        ]);
        setRecords([
          ...products.products.map((p) => ({
            key: `product-${p.id}`,
            icon: 'box' as IconName,
            group: 'Products',
            label: `${p.genericName}${p.brandName ? ` (${p.brandName})` : ''}`,
            sublabel: p.code,
            onSelect: () => go(`/products?q=${encodeURIComponent(p.code)}`),
          })),
          ...customers.customers.map((c) => ({
            key: `customer-${c.id}`,
            icon: 'heart' as IconName,
            group: 'Customers',
            label: c.name,
            sublabel: c.phone || undefined,
            onSelect: () => go(`/customers?q=${encodeURIComponent(c.name)}`),
          })),
          ...suppliers.suppliers.map((s) => ({
            key: `supplier-${s.id}`,
            icon: 'users' as IconName,
            group: 'Suppliers',
            label: s.name,
            sublabel: s.tin || undefined,
            onSelect: () => go(`/suppliers?q=${encodeURIComponent(s.name)}`),
          })),
          ...sales.orders.map((o) => ({
            key: `sale-${o.id}`,
            icon: 'cart' as IconName,
            group: 'Sales',
            label: o.dspNumber,
            sublabel: o.customer?.name || 'Walk-in',
            onSelect: () => go(`/sales?tab=history&q=${encodeURIComponent(o.dspNumber)}`),
          })),
        ]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, isOpen]);

  const pageResults: ResultRow[] = useMemo(() => {
    const q = term.trim().toLowerCase();
    return nav
      .filter((n) => hasPermission(n.permission))
      .filter((n) => !q || n.label.toLowerCase().includes(q))
      .map((n) => ({ key: `page-${n.href}`, icon: n.icon, group: 'Pages', label: n.label, onSelect: () => go(n.href) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, term, hasPermission]);

  const actionResults: ResultRow[] = useMemo(() => {
    const q = term.trim().toLowerCase();
    return ACTIONS.filter((a) => hasPermission(a.permission))
      .filter((a) => !q || a.label.toLowerCase().includes(q))
      .map((a) => ({ key: `action-${a.href}`, icon: a.icon, group: 'Actions', label: a.label, onSelect: () => go(a.href) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, hasPermission]);

  const allResults = [...actionResults, ...pageResults, ...records];

  useEffect(() => setHighlight(0), [term, records]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      allResults[highlight]?.onSelect();
    }
  }

  let lastGroup = '';

  return (
    <CommandPaletteContext.Provider value={{ open: openPalette }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-80 flex items-start justify-center p-4 pt-24 print:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40" onClick={close} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Icon name="search" className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search pages, products, customers, suppliers, sales…"
                className="w-full text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <kbd className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">Esc</kbd>
            </div>
            <div className="max-h-96 overflow-y-auto py-2">
              {searching && <p className="px-4 py-2 text-xs text-slate-400">Searching…</p>}
              {allResults.length === 0 && !searching && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  {term.trim().length === 1 ? 'Keep typing to search records…' : 'No matches.'}
                </p>
              )}
              {allResults.map((r, i) => {
                const showHeader = r.group !== lastGroup;
                lastGroup = r.group;
                return (
                  <div key={r.key}>
                    {showHeader && (
                      <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 first:pt-1">
                        {r.group}
                      </p>
                    )}
                    <button
                      onClick={r.onSelect}
                      onMouseEnter={() => setHighlight(i)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${i === highlight ? 'bg-slate-100' : ''}`}
                    >
                      <Icon name={r.icon} className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-slate-900">{r.label}</span>
                        {r.sublabel && <span className="ml-1.5 text-xs text-slate-400">{r.sublabel}</span>}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </CommandPaletteContext.Provider>
  );
}
