'use client';

import { useEffect, useRef, useState } from 'react';
import { PopoverPortal, usePopoverPosition } from './popover';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * House-built dropdown that stands in for a native <select> — same value/onChange
 * shape as the browser element, but styled and behaved consistently with Combobox
 * (button trigger, portaled listbox, arrow-key + Enter/Escape navigation).
 */
export function Select({ options, value, onChange, placeholder = 'Select…', className, disabled = false }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) || null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const rect = usePopoverPosition(rootRef, open);

  function pick(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (options[highlight]) pick(options[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <button
      ref={rootRef}
      type="button"
      disabled={disabled}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={onKeyDown}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      className={`flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm focus:border-slate-900 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 ${className || ''}`}
    >
      <span className={`truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
        {selected ? selected.label : placeholder}
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 shrink-0 text-slate-400">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
      </svg>

      {open && rect && (
        <PopoverPortal>
          <ul
            ref={listRef}
            role="listbox"
            className="fixed z-70 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-left shadow-xl"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              transform: rect.openUpward ? 'translateY(-100%)' : undefined,
            }}
          >
            {options.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-400">No options</li>}
            {options.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => !o.disabled && setHighlight(i)}
                className={`px-3 py-2 text-sm ${
                  o.disabled
                    ? 'cursor-not-allowed text-slate-300'
                    : `cursor-pointer ${i === highlight ? 'bg-slate-100' : ''} ${o.value === value ? 'font-semibold text-slate-900' : 'text-slate-700'}`
                }`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </PopoverPortal>
      )}
    </button>
  );
}
