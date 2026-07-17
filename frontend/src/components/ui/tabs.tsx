'use client';

import { Select } from './select';

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
 * Section-switching tabs. A row of `flex` buttons quietly breaks down on a
 * phone once there are 3+ tabs or labels get longer than a couple of words —
 * they either overflow the viewport or wrap into a ragged second line. Below
 * `sm` this renders as a single dropdown (reusing the house Select) instead;
 * `sm` and up keeps the familiar underline tab strip.
 */
export function Tabs({ tabs, value, onChange, className = '' }: TabsProps) {
  return (
    <div className={`border-b border-slate-200 ${className}`}>
      <div className="py-2 sm:hidden">
        <Select
          value={value}
          onChange={onChange}
          options={tabs.map((t) => ({
            value: t.key,
            label: t.count != null ? `${t.label} (${t.count})` : t.label,
          }))}
        />
      </div>
      <div className="hidden overflow-x-auto sm:flex sm:gap-1">
        {tabs.map((t) => {
          const active = value === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
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
