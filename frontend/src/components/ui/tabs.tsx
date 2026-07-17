'use client';

import { useEffect, useRef } from 'react';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

/**
 * Section-switching tabs — same underline strip on every breakpoint, but
 * horizontally scrollable with snap instead of wrapping or clipping once
 * there are more tabs (or longer labels) than a phone's width allows. The
 * active tab scrolls itself into view on change, so tapping a tab near the
 * scrolled-off edge doesn't leave it half-hidden.
 */
export function Tabs({ tabs, value, onChange, className = '' }: TabsProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [value]);

  return (
    <div className={`border-b border-slate-200 ${className}`}>
      <div className="scrollbar-none flex snap-x snap-proximity gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = value === t.key;
          return (
            <button
              key={t.key}
              ref={active ? activeRef : undefined}
              onClick={() => onChange(t.key)}
              className={`-mb-px flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium sm:py-2 ${
                active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.label}
              {t.count != null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
