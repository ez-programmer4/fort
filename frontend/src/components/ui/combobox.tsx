'use client';

import { useEffect, useRef, useState } from 'react';

export interface ComboOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ComboboxProps {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  /** For server-side lists: called (debounced) with the typed term; parent refreshes `options`. */
  onSearch?: (term: string) => void;
  /** Quick-create: when set, a "+ Create '<term>'" row appears whenever the typed
   *  term doesn't exactly match an existing option. The parent creates the record
   *  and is responsible for updating `options`/`value` afterwards. */
  onCreate?: (term: string) => void | Promise<void>;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Searchable select for large lists: type to filter, arrow keys + Enter to pick.
 * Client-side filtering by default; pass `onSearch` for server-driven options.
 */
export function Combobox({
  options,
  value,
  onChange,
  onSearch,
  onCreate,
  placeholder = 'Search & select…',
  emptyText = 'No matches',
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) || null;
  const [selectedLabel, setSelectedLabel] = useState('');
  useEffect(() => {
    if (selected) setSelectedLabel(selected.label);
    if (!value) setSelectedLabel('');
  }, [selected, value]);

  const filtered = onSearch
    ? options
    : options.filter((o) =>
        `${o.label} ${o.sublabel || ''}`.toLowerCase().includes(term.toLowerCase()),
      );

  useEffect(() => {
    if (!onSearch || !open) return;
    const t = setTimeout(() => onSearch(term), 300);
    return () => clearTimeout(t);
  }, [term, onSearch, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const trimmedTerm = term.trim();
  const exactMatch = filtered.some((o) => o.label.toLowerCase() === trimmedTerm.toLowerCase());
  const showCreate = Boolean(onCreate) && trimmedTerm.length > 0 && !exactMatch;
  const totalItems = filtered.length + (showCreate ? 1 : 0);

  useEffect(() => setHighlight(0), [filtered.length, showCreate, open]);

  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  function pick(opt: ComboOption) {
    onChange(opt.value);
    setSelectedLabel(opt.label);
    setTerm('');
    setOpen(false);
  }

  async function handleCreate() {
    if (!onCreate || !trimmedTerm) return;
    await onCreate(trimmedTerm);
    setTerm('');
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight < filtered.length && filtered[highlight]) pick(filtered[highlight]);
      else if (showCreate) handleCreate();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className || ''}`}>
      <div className="relative">
        <input
          ref={inputRef}
          disabled={disabled}
          value={open ? term : selectedLabel}
          placeholder={selected ? selected.label : placeholder}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => {
            setOpen(true);
            setTerm('');
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          className="w-full rounded-md border border-slate-300 py-2 pl-3 pr-14 text-sm focus:border-slate-900 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => {
                onChange('');
                setSelectedLabel('');
                setTerm('');
              }}
              className="rounded p-0.5 text-slate-400 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
          </svg>
        </div>
      </div>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl"
        >
          {filtered.length === 0 && !showCreate && (
            <li className="px-3 py-2.5 text-sm text-slate-400">{emptyText}</li>
          )}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === highlight ? 'bg-slate-100' : ''
              } ${o.value === value ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
            >
              <p className="truncate">{o.label}</p>
              {o.sublabel && <p className="truncate text-xs text-slate-400">{o.sublabel}</p>}
            </li>
          ))}
          {showCreate && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              onMouseEnter={() => setHighlight(filtered.length)}
              className={`cursor-pointer border-t border-slate-100 px-3 py-2 text-sm font-medium text-slate-900 ${
                highlight === filtered.length ? 'bg-slate-100' : ''
              }`}
            >
              + Create &ldquo;{trimmedTerm}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
