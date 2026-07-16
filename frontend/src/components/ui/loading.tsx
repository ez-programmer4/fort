'use client';

/** Branded full-page loading state. */
export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-base font-bold text-white">
          F
        </span>
        <span className="text-lg font-bold tracking-tight text-slate-900">
          Fort<span className="font-normal text-slate-500">Inventory</span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner className="h-4 w-4" />
        {label}
      </div>
    </div>
  );
}

/** Inline spinner. */
export function Spinner({
  className = 'h-5 w-5',
  colorClassName = 'text-slate-900',
}: {
  className?: string;
  colorClassName?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${colorClassName} ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Skeleton rows for tables while data loads. */
export function SkeletonRows({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-100 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div
                className="h-3.5 animate-pulse rounded bg-slate-100"
                style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
