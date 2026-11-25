'use client';

import { useState } from 'react';
import { CHART_CATEGORICAL, CHART_OTHER } from './helpers';

/*
 * Part-to-whole donut in the BarChart's visual language. Colours come from CHART_CATEGORICAL in
 * data order (assigned by entity, so a part keeps its colour), slices are drawn in that same
 * order (the palette's adjacent-pair check assumes it), and a 2px white gap separates slices.
 * Every part is named in the legend with its value and share: identity never rests on colour
 * alone, and the paler slots get the visible labels the contrast check requires.
 * Hovering a slice or legend row dims the rest and shows that part in the centre.
 */

export interface DonutDatum {
  label: string;
  value: number;
  /** Pre-formatted value text; wins over `valueFormat`. */
  display?: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  valueFormat?: (n: number) => string;
  /** Word under the total in the centre, e.g. "tickets". */
  totalLabel?: string;
  /** Accessible name for the chart. */
  ariaLabel?: string;
  /** Shown when there is nothing to draw. */
  emptyLabel?: string;
  className?: string;
}

const MAX_SLOTS = CHART_CATEGORICAL.length;
const SIZE = 200;
const C = SIZE / 2;
const R_OUT = 96;
const R_IN = 62;

interface Part extends DonutDatum {
  color: string;
}

/** More parts than colours: keep the first N-1 in the given order and fold the rest into "Other". */
function fold(data: DonutDatum[]): Part[] {
  const withColor = (d: DonutDatum, i: number): Part => ({ ...d, color: CHART_CATEGORICAL[i] });
  if (data.length <= MAX_SLOTS) return data.map(withColor);
  const kept = data.slice(0, MAX_SLOTS - 1).map(withColor);
  const rest = data.slice(MAX_SLOTS - 1).reduce((sum, d) => sum + d.value, 0);
  return [...kept, { label: 'Other', value: rest, color: CHART_OTHER }];
}

function point(angle: number, r: number) {
  return `${(C + r * Math.cos(angle)).toFixed(3)} ${(C + r * Math.sin(angle)).toFixed(3)}`;
}

/** Ring segment from a0 to a1 (radians, clockwise from 12 o'clock after the -90° offset). */
function segment(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${point(a0, R_OUT)}`,
    `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${point(a1, R_OUT)}`,
    `L ${point(a1, R_IN)}`,
    `A ${R_IN} ${R_IN} 0 ${large} 0 ${point(a0, R_IN)}`,
    'Z',
  ].join(' ');
}

function share(value: number, total: number): string {
  if (total <= 0 || value <= 0) return '0%';
  const pct = (value / total) * 100;
  return pct < 1 ? '<1%' : `${Math.round(pct)}%`;
}

export function DonutChart({
  data,
  valueFormat = (n) => n.toLocaleString('en-IN'),
  totalLabel = 'total',
  ariaLabel = 'Donut chart',
  emptyLabel = 'No data',
  className = '',
}: DonutChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const parts = fold(data);
  const total = parts.reduce((sum, p) => sum + Math.max(0, p.value), 0);

  if (parts.length === 0 || total <= 0) {
    return <p className={`py-6 text-center text-12 text-ink-muted ${className}`}>{emptyLabel}</p>;
  }

  const text = (p: DonutDatum) => p.display ?? valueFormat(p.value);
  const sweeps = parts.map((p) => (Math.max(0, p.value) / total) * Math.PI * 2);
  const arcs = sweeps.map((sweep, i) => {
    const a0 = -Math.PI / 2 + sweeps.slice(0, i).reduce((sum, s) => sum + s, 0);
    return { i, a0, a1: a0 + sweep, sweep };
  });
  const focus = active !== null ? parts[active] : null;
  const summary = parts.map((p) => `${p.label}: ${text(p)} (${share(p.value, total)})`).join('; ');

  return (
    // Container query: the legend moves beside the donut only when the CARD is wide enough
    // (a half-width dashboard card on a phone-sized viewport stacks instead of truncating names).
    <div className={`@container ${className}`}>
    <div className="flex flex-col items-center gap-5 @md:flex-row @md:items-center">
      <div className="relative w-[180px] shrink-0">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label={`${ariaLabel}. ${summary}`}>
          {arcs.map(({ i, a0, a1, sweep }) => {
            if (sweep <= 0) return null;
            const dim = active !== null && active !== i;
            const common = {
              fill: parts[i].color,
              stroke: '#ffffff',
              strokeWidth: 2,
              opacity: dim ? 0.3 : 1,
              className: 'cursor-default transition-opacity',
              onMouseEnter: () => setActive(i),
              onMouseLeave: () => setActive(null),
            };
            // A lone 100% part: an arc can't start and end at the same point, so draw two halves.
            if (sweep >= Math.PI * 2 - 1e-6) {
              return (
                <g key={i}>
                  <path d={segment(a0, a0 + Math.PI)} {...common} />
                  <path d={segment(a0 + Math.PI, a1)} {...common} />
                </g>
              );
            }
            return <path key={i} d={segment(a0, a1)} {...common} />;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center" aria-hidden="true">
          {focus ? (
            <>
              <span className="text-20 font-semibold text-ink">{text(focus)}</span>
              <span className="text-12 text-ink-tertiary">{share(focus.value, total)}</span>
            </>
          ) : (
            <>
              <span className="text-20 font-semibold text-ink">{valueFormat(total)}</span>
              <span className="text-12 text-ink-tertiary">{totalLabel}</span>
            </>
          )}
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-0.5" aria-label={`${ariaLabel} legend`}>
        {parts.map((p, i) => (
          <li
            key={`${p.label}-${i}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center gap-2 rounded-4 px-2 py-1 text-12 transition-opacity ${
              active === i ? 'bg-surface-secondary' : ''
            } ${active !== null && active !== i ? 'opacity-50' : ''}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-2" style={{ backgroundColor: p.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-ink" title={p.label}>
              {p.label}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-ink">{text(p)}</span>
            <span className="w-9 shrink-0 text-right tabular-nums text-ink-tertiary">{share(p.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}
