'use client';

import { useMemo, useRef, useState } from 'react';

export interface TrendSeriesDef {
  key: string;
  label: string;
  color: string;
}

interface TrendRow {
  label: string;
  [key: string]: number | string;
}

interface TrendChartProps {
  data: TrendRow[];
  series: TrendSeriesDef[];
  height?: number;
  formatValue?: (v: number) => string;
  formatAxisLabel?: (label: string) => string;
  emptyText?: string;
}

const VB_W = 1000;
const PAD = { top: 16, right: 12, bottom: 28, left: 46 };

function niceMax(max: number) {
  if (max <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const residual = max / magnitude;
  let step;
  if (residual > 5) step = 10;
  else if (residual > 2) step = 5;
  else if (residual > 1) step = 2;
  else step = 1;
  return step * magnitude;
}

function compact(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

/** 2-series (max) line chart with crosshair + tooltip, hairline gridlines, and a legend. */
export function TrendChart({
  data,
  series,
  height = 220,
  formatValue = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  formatAxisLabel = (l) => l,
  emptyText = 'No data for this period.',
}: TrendChartProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const n = data.length;

  const maxVal = useMemo(() => {
    let m = 0;
    for (const row of data) for (const s of series) m = Math.max(m, Number(row[s.key]) || 0);
    return niceMax(m || 1);
  }, [data, series]);

  const xFor = (i: number) => (n <= 1 ? PAD.left + plotW / 2 : PAD.left + (plotW * i) / (n - 1));
  const yFor = (v: number) => PAD.top + plotH - (plotH * v) / maxVal;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!rootRef.current || n === 0) return;
    const rect = rootRef.current.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(frac * (n - 1));
    setHoverIndex(Math.max(0, Math.min(n - 1, idx)));
  }

  if (n === 0) {
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center text-sm text-slate-400">{emptyText}</div>
    );
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxVal);
  const xLabelStep = Math.max(1, Math.ceil(n / 7));
  const leftPct = hoverIndex != null ? Math.min(90, Math.max(10, (xFor(hoverIndex) / VB_W) * 100)) : 0;

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
      <div ref={rootRef} className="relative" onMouseMove={onMove} onMouseLeave={() => setHoverIndex(null)}>
        <svg viewBox={`0 0 ${VB_W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
          {yTicks.map((t, i) => {
            const y = yFor(t);
            return (
              <g key={i}>
                <line x1={PAD.left} x2={VB_W - PAD.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#94a3b8">
                  {compact(t)}
                </text>
              </g>
            );
          })}
          {data.map((row, i) =>
            i % xLabelStep === 0 ? (
              <text key={i} x={xFor(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="#94a3b8">
                {formatAxisLabel(String(row.label))}
              </text>
            ) : null,
          )}
          {hoverIndex != null && (
            <line
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#cbd5e1"
              strokeWidth={1}
            />
          )}
          {series.map((s) => {
            const points = data.map((row, i) => `${xFor(i)},${yFor(Number(row[s.key]) || 0)}`).join(' ');
            const last = n - 1;
            return (
              <g key={s.key}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={xFor(last)} cy={yFor(Number(data[last][s.key]) || 0)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
                {hoverIndex != null && (
                  <circle
                    cx={xFor(hoverIndex)}
                    cy={yFor(Number(data[hoverIndex][s.key]) || 0)}
                    r={4}
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {hoverIndex != null && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: `${leftPct}%` }}
          >
            <p className="mb-1 font-medium text-slate-500">{formatAxisLabel(String(data[hoverIndex].label))}</p>
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatValue(Number(data[hoverIndex][s.key]) || 0)}
                </span>
                <span className="text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export interface RankBarRow {
  label: string;
  sublabel?: string;
  value: number;
}

/** Ranked horizontal bar list — for "top N" tables (products by margin/volume). */
export function RankBars({
  rows,
  color = '#2a78d6',
  formatValue = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 }),
  emptyText = 'No data for this period.',
}: {
  rows: RankBarRow[];
  color?: string;
  formatValue?: (v: number) => string;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return <div className="flex min-h-[120px] items-center justify-center text-sm text-slate-400">{emptyText}</div>;
  }
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const pct = Math.max(2, (Math.abs(r.value) / max) * 100);
        return (
          <div key={i}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">
                <span className="font-medium text-slate-900">{r.label}</span>
                {r.sublabel && <span className="ml-1 text-xs text-slate-400">{r.sublabel}</span>}
              </span>
              <span className="shrink-0 tabular-nums font-medium text-slate-900">{formatValue(r.value)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-r-full rounded-l-sm" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
