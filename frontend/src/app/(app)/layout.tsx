'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

// Nav grows as phases are built — permission gates which links a user sees
const NAV = [
  { href: '/dashboard', label: 'Dashboard', permission: 'dashboard.view' },
  { href: '/users', label: 'Users', permission: 'users.manage' },
  { href: '/roles', label: 'Roles & Permissions', permission: 'roles.manage' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col bg-slate-900 text-slate-200">
        <div className="border-b border-slate-800 px-5 py-4">
          <span className="text-lg font-bold text-emerald-400">FortInventory</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.filter((item) => hasPermission(item.permission)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm ${
                pathname.startsWith(item.href)
                  ? 'bg-emerald-600 font-semibold text-white'
                  : 'hover:bg-slate-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4 text-sm">
          <p className="font-medium text-white">{user.fullName}</p>
          <p className="text-xs text-slate-400">{user.role}</p>
          <button
            onClick={logout}
            className="mt-3 w-full rounded-md bg-slate-800 py-1.5 text-xs hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-8">{children}</main>
    </div>
  );
}
