'use client';

import { useEffect, useRef, useState } from 'react';

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

interface LineChartProps {
  categories: string[];
  series: ChartSeries[];
  /** Fixed y-domain; defaults to a rounded domain around the data. */
  yDomain?: [number, number];
  yTicks?: number;
  formatY?: (v: number) => string;
  /** Rank-style axis where smaller is better (0 at the top). */
  invert?: boolean;
  height?: number;
  /** 10% wash under each line. */
  area?: boolean;
  ariaLabel: string;
}

const PAD = { top: 12, right: 16, bottom: 28, left: 48 };

/** Smooth path through points (Catmull-Rom converted to cubic Béziers). */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function niceDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const step = Math.pow(10, Math.floor(Math.log10(span)));
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

export function LineChart({
  categories,
  series,
  yDomain,
  yTicks = 5,
  formatY = (v) => String(v),
  invert = false,
  height = 300,
  area = false,
  ariaLabel,
}: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [lo, hi] = yDomain ?? niceDomain(series.flatMap((s) => s.values));
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (categories.length === 1 ? plotW / 2 : (i / (categories.length - 1)) * plotW);
  const y = (v: number) => {
    const t = (v - lo) / (hi - lo || 1);
    return PAD.top + (invert ? t : 1 - t) * plotH;
  };
  const ticks = Array.from({ length: yTicks }, (_, i) => lo + ((hi - lo) * i) / (yTicks - 1));

  return (
    <div ref={ref} className="w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        {series.length > 1 ? (
          <ul className="flex flex-wrap gap-4" aria-label="Legend">
            {series.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5 text-12 text-ink-tertiary">
                <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
                {s.name}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => setAsTable((t) => !t)} className="text-12 text-link underline decoration-dashed underline-offset-4">
          {asTable ? 'View as chart' : 'View as table'}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-12">
          <thead>
            <tr className="bg-surface-tertiary text-ink-tertiary">
              <th className="px-3 py-2 text-left font-normal">Period</th>
              {series.map((s) => (
                <th key={s.name} className="px-3 py-2 text-right font-normal">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={c} className="border-t border-alpha-4">
                <td className="px-3 py-2 text-ink">{c}</td>
                {series.map((s) => (
                  <td key={s.name} className="px-3 py-2 text-right tabular-nums text-ink">
                    {formatY(s.values[i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg role="img" aria-label={ariaLabel} width={width} height={height} className="block" onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#E5E7EB" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#6C737F">
                  {formatY(t)}
                </text>
              </g>
            ))}
            {categories.map((c, i) => (
              <text
                key={c}
                x={x(i)}
                y={height - 8}
                textAnchor={categories.length === 1 ? 'middle' : i === 0 ? 'start' : i === categories.length - 1 ? 'end' : 'middle'}
                fontSize={11}
                fill="#6C737F"
              >
                {c}
              </text>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="#9DA4AE" strokeWidth={1} />}
            {series.map((s) => {
              const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
              const line = smoothPath(pts);
              const base = invert ? PAD.top : PAD.top + plotH;
              return (
                <g key={s.name}>
                  {area && (
                    <path d={`${line} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z`} fill={s.color} opacity={0.1} />
                  )}
                  <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  {pts.map(([px, py], i) => (
                    <circle key={i} cx={px} cy={py} r={hover === i ? 5 : 4} fill={s.color} stroke="#fff" strokeWidth={2} />
                  ))}
                </g>
              );
            })}
            {categories.map((c, i) => (
              <rect
                key={c}
                data-testid="chart-hit"
                x={x(i) - plotW / Math.max(1, categories.length - 1) / 2}
                y={PAD.top}
                width={plotW / Math.max(1, categories.length - 1)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            ))}
          </svg>
          {hover !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 rounded-8 border border-line-secondary bg-white px-3 py-2 text-12 shadow-dock-xl"
              style={{ left: Math.min(x(hover) + 12, width - 180), top: PAD.top }}
            >
              <p className="mb-1 font-medium text-ink">{categories[hover]}</p>
              {series.map((s) => (
                <p key={s.name} className="flex items-center gap-2 text-ink-tertiary">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                  <span className="ml-auto pl-3 tabular-nums text-ink">{formatY(s.values[hover])}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
