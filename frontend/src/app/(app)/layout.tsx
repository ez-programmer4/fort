'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Icon, IconName } from '@/components/icons';
import { LoadingScreen } from '@/components/ui/loading';

// Nav grows as phases are built — permission gates which links a user sees
const NAV: { href: string; label: string; icon: IconName; permission: string }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard.view' },
  { href: '/alerts', label: 'Alerts', icon: 'bell', permission: 'alerts.view' },
  { href: '/products', label: 'Products', icon: 'box', permission: 'products.view' },
  { href: '/inventory', label: 'Inventory', icon: 'stack', permission: 'inventory.view' },
  { href: '/bincard', label: 'Bin Card', icon: 'document', permission: 'products.view' },
  { href: '/procurement', label: 'Procurement', icon: 'truck', permission: 'procurement.view' },
  { href: '/sales', label: 'Sales & Dispensing', icon: 'cart', permission: 'sales.view' },
  { href: '/wallet', label: 'Wallet', icon: 'wallet', permission: 'finance.view' },
  { href: '/reports', label: 'Reports', icon: 'chart', permission: 'reports.view' },
  { href: '/locations', label: 'Locations', icon: 'mapPin', permission: 'locations.manage' },
  { href: '/suppliers', label: 'Suppliers', icon: 'users', permission: 'suppliers.manage' },
  { href: '/audit', label: 'Audit Trail', icon: 'clipboard', permission: 'inventory.view' },
  { href: '/users', label: 'Users', icon: 'users', permission: 'users.manage' },
  { href: '/roles', label: 'Roles & Permissions', icon: 'shield', permission: 'roles.manage' },
  { href: '/settings', label: 'Settings', icon: 'gear', permission: 'settings.manage' },
];

const COLLAPSE_KEY = 'fort_sidebar_collapsed';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored !== null) {
      setCollapsed(stored === '1');
    } else {
      // No saved preference: start collapsed on tablet-width screens
      setCollapsed(window.matchMedia('(max-width: 1024px)').matches);
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // The sidebar closes itself on route change so navigating on mobile doesn't
  // leave the overlay open over the new page.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleSidebar() {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1');
      return !prev;
    });
  }

  if (loading || !user) {
    return <LoadingScreen label="Preparing your workspace…" />;
  }

  const current = NAV.find((n) => pathname.startsWith(n.href));
  // On mobile the sidebar is a full-width overlay, so the icon-only
  // "collapsed" treatment only ever applies once we're at the md breakpoint.
  const railCollapsed = isDesktop && collapsed;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 print:hidden md:sticky md:top-0 md:translate-x-0 md:transition-[width] ${
          railCollapsed ? 'md:w-16' : 'md:w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`flex h-14 shrink-0 items-center border-b border-slate-200 px-5 ${railCollapsed ? 'justify-center px-0' : ''}`}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
            F
          </span>
          {!railCollapsed && (
            <span className="ml-2.5 truncate text-base font-bold tracking-tight text-slate-900">
              Fort<span className="font-normal text-slate-500">Inventory</span>
            </span>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 md:hidden"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={toggleSidebar}
          aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-4.5 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 md:flex"
        >
          <Icon name="chevronsLeft" className={`h-3.5 w-3.5 transition-transform ${railCollapsed ? 'rotate-180' : ''}`} />
        </button>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {NAV.filter((item) => hasPermission(item.permission)).map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={railCollapsed ? item.label : undefined}
                className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
                  active
                    ? 'bg-slate-900 font-medium text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${railCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                {!railCollapsed && <span className="truncate">{item.label}</span>}
                {railCollapsed && (
                  <span className="pointer-events-none absolute left-full z-40 ml-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={`shrink-0 border-t border-slate-200 p-3 ${railCollapsed ? 'p-2' : ''}`}>
          <div className={`flex items-center gap-2.5 rounded-md px-1 py-1.5 ${railCollapsed ? 'justify-center' : ''}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
              {user.fullName.slice(0, 2).toUpperCase()}
            </span>
            {!railCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight text-slate-900">{user.fullName}</p>
                <p className="truncate text-xs leading-tight text-slate-500">{user.role}</p>
              </div>
            )}
            {!railCollapsed && (
              <button
                onClick={logout}
                aria-label="Sign out"
                className="group relative shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <Icon name="logout" className="h-4 w-4" />
                <span className="pointer-events-none absolute bottom-full right-0 z-40 mb-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  Sign out
                </span>
              </button>
            )}
          </div>
          {railCollapsed && (
            <button
              onClick={logout}
              aria-label="Sign out"
              className="group relative mt-1 hidden w-full items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 md:flex"
            >
              <Icon name="logout" className="h-4 w-4" />
              <span className="pointer-events-none absolute left-full z-40 ml-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                Sign out
              </span>
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 print:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="-ml-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-medium text-slate-900">{current?.label ?? ''}</span>
        </header>
        <main className="flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
