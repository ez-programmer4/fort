'use client';

import { useEffect, useRef, useState } from 'react';

// Dates travel as 'YYYY-MM-DD' strings (matches API query params).

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISO(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, day] = s.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

function fmt(s: string) {
  const d = parseISO(s);
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Weeks (Monday-first) covering the given month. */
function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

function CalendarPanel({
  view,
  setView,
  isSelected,
  isInRange,
  onPick,
  footer,
}: {
  view: { y: number; m: number };
  setView: (v: { y: number; m: number }) => void;
  isSelected: (iso: string) => boolean;
  isInRange?: (iso: string) => boolean;
  onPick: (iso: string) => void;
  footer?: React.ReactNode;
}) {
  const todayISO = toISO(new Date());
  const nav = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div className="w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
      <div className="flex items-center justify-between px-1">
        <button type="button" onClick={() => nav(-1)} aria-label="Previous month"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-slate-900">{MONTHS[view.m]} {view.y}</span>
        <button type="button" onClick={() => nav(1)} aria-label="Next month"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-medium uppercase text-slate-400">
        {DOW.map((d) => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {monthGrid(view.y, view.m).flat().map((d, i) => {
          if (!d) return <span key={i} />;
          const iso = toISO(d);
          const selected = isSelected(iso);
          const inRange = isInRange?.(iso) && !selected;
          const isToday = iso === todayISO;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(iso)}
              className={`m-0.5 flex h-8 items-center justify-center rounded-md text-sm tabular-nums ${
                selected
                  ? 'bg-slate-900 font-semibold text-white'
                  : inRange
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-700 hover:bg-slate-100'
              } ${isToday && !selected ? 'ring-1 ring-inset ring-slate-400' : ''}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      {footer && <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">{footer}</div>}
    </div>
  );
}

function TriggerButton({
  text,
  placeholder,
  onClick,
  onClear,
  className,
}: {
  text: string;
  placeholder: string;
  onClick: () => void;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className || 'w-full'}`}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-left text-sm focus:border-slate-900 focus:outline-none"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 shrink-0 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <span className={text ? 'text-slate-900' : 'text-slate-400'}>{text || placeholder}</span>
      </button>
      {text && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear date"
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

/** Single-date picker. value is '' or 'YYYY-MM-DD'. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const now = parseISO(value) || new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const ref = useOutsideClose(open, () => setOpen(false));

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <TriggerButton
        text={value ? fmt(value) : ''}
        placeholder={placeholder}
        onClick={() => {
          const d = parseISO(value) || new Date();
          setView({ y: d.getFullYear(), m: d.getMonth() });
          setOpen(!open);
        }}
        onClear={() => onChange('')}
      />
      {open && (
        <div className="absolute z-40 mt-1">
          <CalendarPanel
            view={view}
            setView={setView}
            isSelected={(iso) => iso === value}
            onPick={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
            footer={
              <button
                type="button"
                onClick={() => {
                  onChange(toISO(new Date()));
                  setOpen(false);
                }}
                className="text-xs font-medium text-slate-900 underline underline-offset-2"
              >
                Today
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

/** Date-range picker: first click = start, second click = end (auto-swaps). */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = 'Pick a date range',
  className,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = parseISO(from) || new Date();
  const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() });
  const ref = useOutsideClose(open, () => setOpen(false));

  const text = from && to ? `${fmt(from)} — ${fmt(to)}` : from ? `${fmt(from)} — …` : '';

  function pick(iso: string) {
    if (!from || (from && to)) {
      onChange({ from: iso, to: '' });
    } else {
      const range = iso < from ? { from: iso, to: from } : { from, to: iso };
      onChange(range);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <TriggerButton
        text={text}
        placeholder={placeholder}
        onClick={() => {
          const d = parseISO(from) || new Date();
          setView({ y: d.getFullYear(), m: d.getMonth() });
          setOpen(!open);
        }}
        onClear={() => onChange({ from: '', to: '' })}
      />
      {open && (
        <div className="absolute z-40 mt-1">
          <CalendarPanel
            view={view}
            setView={setView}
            isSelected={(iso) => iso === from || iso === to}
            isInRange={(iso) => !!(from && to && iso > from && iso < to)}
            onPick={pick}
            footer={
              <span className="text-[11px] text-slate-400">
                {!from || (from && to) ? 'Pick a start date' : 'Now pick the end date'}
              </span>
            }
          />
        </div>
      )}
    </div>
  );
}
