'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Icon, type IconName } from '@/components/icons';
import { LoadingScreen, Spinner } from '@/components/ui/loading';
import { FloatingPharmaIcons } from '@/components/marketing/decorative';

const HIGHLIGHTS: { icon: IconName; title: string; description: string }[] = [
  { icon: 'chart', title: 'Real-time visibility', description: 'Live stock levels across every warehouse and dispensary.' },
  { icon: 'document', title: 'Full audit trail', description: 'Every movement logged — who, what, when and why.' },
  { icon: 'shield', title: 'Role-based access', description: 'Admin, Accountant, Operations and Sales each see exactly what they need.' },
];

const inputClass =
  'w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return <LoadingScreen />;
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-slate-900 md:flex md:flex-col md:justify-between md:p-10 lg:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-600/25 blur-3xl" />
        <FloatingPharmaIcons variant="dark" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Fort Pharma PLC" className="h-full w-full object-contain" />
          </span>
        </div>

        <div className="relative">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white">
            Run your pharmacy operation from one place.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
            FortInventory is the platform behind Fort Pharma PLC&apos;s sourcing, stock and sales —
            built for the team that keeps it running.
          </p>
          <ul className="mt-9 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon name={h.icon} className="h-4 w-4 text-blue-400" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{h.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{h.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} Fort Pharma PLC. Internal use only.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Fort Pharma PLC" className="h-10 w-auto object-contain" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
            FortInventory Portal
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage inventory, orders and sales.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <div className="relative mt-1">
                <Icon name="mail" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@fortpharma.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="relative mt-1">
                <Icon name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-9`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eyeSlash' : 'eye'} className="h-4 w-4" />
                </button>
              </div>
            </div>

            {error && (
              <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                <Icon name="x" className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
            >
              {submitting && <Spinner className="h-4 w-4" colorClassName="text-white" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Access is provisioned by your administrator — contact them if you need an account.
          </p>
        </div>
      </div>
    </main>
  );
}
