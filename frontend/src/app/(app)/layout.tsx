'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Icon, IconName } from '@/components/icons';

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
  { href: '/users', label: 'Users', icon: 'users', permission: 'users.manage' },
  { href: '/roles', label: 'Roles & Permissions', icon: 'shield', permission: 'roles.manage' },
];

const COLLAPSE_KEY = 'fort_sidebar_collapsed';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
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
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Loading…
      </main>
    );
  }

  const current = NAV.find((n) => pathname.startsWith(n.href));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={`flex flex-col border-r border-slate-200 bg-white transition-all duration-200 print:hidden ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className={`flex h-14 items-center border-b border-slate-200 ${collapsed ? 'justify-center' : 'px-5'}`}>
          {collapsed ? (
            <span className="text-base font-bold tracking-tight text-slate-900">F</span>
          ) : (
            <span className="text-base font-bold tracking-tight text-slate-900">
              Fort<span className="font-normal text-slate-500">Inventory</span>
            </span>
          )}
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV.filter((item) => hasPermission(item.permission)).map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                  active
                    ? 'bg-slate-900 font-medium text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white pl-3 pr-6 print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-slate-900">{current?.label ?? ''}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight text-slate-900">{user.fullName}</p>
              <p className="text-xs leading-tight text-slate-500">{user.role}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon name="logout" className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-x-auto p-6">{children}</main>
      </div>
    </div>
  );
}
