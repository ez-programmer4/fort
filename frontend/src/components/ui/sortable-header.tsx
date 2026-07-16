'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';

export type SortDir = 'asc' | 'desc';

/** Tracks the active sort column + direction for a table; click toggles asc/desc, a new column starts ascending. */
export function useSort(defaultKey: string, defaultDir: SortDir = 'asc') {
  const [sortBy, setSortBy] = useState(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggle(key: string) {
    if (key === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  }

  /** Reset to a new default column (e.g. when switching tabs to a different table shape). */
  function reset(key: string, dir: SortDir = 'asc') {
    setSortBy(key);
    setSortDir(dir);
  }

  return { sortBy, sortDir, toggle, reset };
}

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  sortBy: string;
  sortDir: SortDir;
  onSort: (key: string) => void;
  align?: 'left' | 'right';
  className?: string;
}

/** Clickable <th> with an active/neutral sort indicator — pairs with useSort. */
export function SortableHeader({
  label,
  sortKey,
  sortBy,
  sortDir,
  onSort,
  align = 'left',
  className = '',
}: SortableHeaderProps) {
  const active = sortBy === sortKey;
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${active ? 'text-slate-900' : ''}`}
      >
        {label}
        <Icon
          name={active ? (sortDir === 'asc' ? 'chevronUp' : 'chevronDown') : 'chevronUpDown'}
          className={`h-3.5 w-3.5 ${active ? 'text-slate-700' : 'text-slate-300'}`}
        />
      </button>
    </th>
  );
}
