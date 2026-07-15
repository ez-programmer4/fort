'use client';

import { useAuth } from '@/lib/auth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Welcome back, {user?.fullName}.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {['Stock Overview', 'Low Stock / Expiring Alerts', 'Sales Summary'].map((title) => (
          <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
            <p className="mt-2 text-xs text-slate-400">
              Live data arrives in Phase 8 — after inventory, procurement and sales are built.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
