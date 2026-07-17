'use client';

import { Select } from './select';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sizes?: number[];
}

/** Standard table footer: rows-per-page selector + range info + prev/next. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  sizes = [10, 25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Rows per page</span>
        <Select
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange(Number(v))}
          options={sizes.map((s) => ({ value: String(s), label: String(s) }))}
          className="w-20 py-1"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular-nums text-xs text-slate-500">
          {from}–{to} of {total}
        </span>
        <div className="flex gap-1">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
