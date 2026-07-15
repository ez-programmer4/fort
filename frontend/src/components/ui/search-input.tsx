'use client';

import { useEffect, useRef, useState } from 'react';

interface SearchInputProps {
  onSearch: (term: string) => void;
  placeholder?: string;
  minChars?: number;
  delay?: number;
  className?: string;
}

/**
 * Debounced search box: fires `onSearch` 350 ms after typing stops,
 * and only for empty input (reset) or terms of `minChars`+ characters.
 */
export function SearchInput({
  onSearch,
  placeholder = 'Search…',
  minChars = 2,
  delay = 350,
  className = 'w-64',
}: SearchInputProps) {
  const [value, setValue] = useState('');
  const lastFired = useRef('');

  useEffect(() => {
    const term = value.trim();
    const shouldFire = term.length === 0 || term.length >= minChars;
    if (!shouldFire) return;
    if (term === lastFired.current) return;
    const t = setTimeout(() => {
      lastFired.current = term;
      onSearch(term);
    }, delay);
    return () => clearTimeout(t);
  }, [value, minChars, delay, onSearch]);

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-8 text-sm focus:border-slate-900 focus:outline-none"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
