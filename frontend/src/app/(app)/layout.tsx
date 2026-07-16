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
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={`sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 print:hidden ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className={`flex h-14 shrink-0 items-center border-b border-slate-200 ${collapsed ? 'justify-center' : 'px-5'}`}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
            F
          </span>
          {!collapsed && (
            <span className="ml-2.5 truncate text-base font-bold tracking-tight text-slate-900">
              Fort<span className="font-normal text-slate-500">Inventory</span>
            </span>
          )}
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {NAV.filter((item) => hasPermission(item.permission)).map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
                  active
                    ? 'bg-slate-900 font-medium text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-40">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={`shrink-0 border-t border-slate-200 ${collapsed ? 'p-2' : 'p-3'}`}>
          <div className={`flex items-center gap-2.5 rounded-md px-1 py-1.5 ${collapsed ? 'justify-center' : ''}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
              {user.fullName.slice(0, 2).toUpperCase()}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight text-slate-900">{user.fullName}</p>
                <p className="truncate text-xs leading-tight text-slate-500">{user.role}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={logout}
                title="Sign out"
                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <Icon name="logout" className="h-4 w-4" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={logout}
              title="Sign out"
              className="mt-1 flex w-full items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <Icon name="logout" className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={toggleSidebar}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <Icon name="chevronsLeft" className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 print:hidden">
          <span className="text-sm font-medium text-slate-900">{current?.label ?? ''}</span>
        </header>
        <main className="flex-1 overflow-x-auto p-6">{children}</main>
      </div>
    </div>
  );
}
