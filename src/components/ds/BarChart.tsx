import Link from 'next/link';
import { CHART_COLORS } from './helpers';

/*
 * Horizontal bar chart in the LineChart's visual language (11-12px ink-muted text, #E5E7EB
 * gridlines, CHART_COLORS). Plain HTML/CSS, no hooks and no "use client": it renders in server
 * components and in client ones, and widths are percentages so it never overflows at 360px.
 */

export interface BarDatum {
  label: string;
  value: number;
  /** Pre-formatted value text; wins over `valueFormat` (use it when the formatter can't be passed, e.g. server → client). */
  display?: string;
  /** Optional link for the whole row (rendered with next/link). */
  href?: string;
  /** Small muted line under the label (e.g. "12 paid · 3 pending"). */
  caption?: string;
  /** Per-bar colour; defaults to the chart's `color`. */
  color?: string;
}

interface BarChartProps {
  data: BarDatum[];
  valueFormat?: (n: number) => string;
  /** Bar colour (default CHART_COLORS.blue). */
  color?: string;
  /** Show only the first N rows (in the given order) and a "+k more" note. */
  maxBars?: number;
  /** Accessible name for the list. */
  ariaLabel?: string;
  /** Faint quarter gridlines behind the bars (default true). */
  gridlines?: boolean;
  /** Shown when `data` is empty. */
  emptyLabel?: string;
  className?: string;
}

// Room kept at the end of the track for the value text after the longest bar.
const VALUE_ROOM = '4.75rem';

export function BarChart({
  data,
  valueFormat = (n) => n.toLocaleString('en-IN'),
  color = CHART_COLORS.blue,
  maxBars,
  ariaLabel = 'Bar chart',
  gridlines = true,
  emptyLabel = 'No data',
  className = '',
}: BarChartProps) {
  if (data.length === 0) {
    return <p className={`py-6 text-center text-12 text-ink-muted ${className}`}>{emptyLabel}</p>;
  }

  const shown = maxBars !== undefined && maxBars >= 0 ? data.slice(0, maxBars) : data;
  const hidden = data.length - shown.length;
  const max = Math.max(0, ...shown.map((d) => d.value));

  return (
    <div className={`w-full min-w-0 ${className}`}>
      <ul role="list" aria-label={ariaLabel} className="flex flex-col">
        {shown.map((d, i) => {
          const text = d.display ?? valueFormat(d.value);
          const frac = max > 0 ? Math.max(0, d.value) / max : 0;
          const name = `${d.label}: ${text}${d.caption ? `, ${d.caption}` : ''}`;
          const row = (
            <>
              <span className="w-[38%] max-w-[200px] min-w-0 shrink-0 py-1.5 pr-3">
                <span title={d.label} className={`block truncate text-12 text-ink ${d.href ? 'group-hover:underline group-hover:underline-offset-2' : ''}`}>
                  {d.label}
                </span>
                {d.caption && (
                  <span title={d.caption} className="block truncate text-10 text-ink-muted">
                    {d.caption}
                  </span>
                )}
              </span>
              <span aria-hidden="true" className="relative flex min-w-0 flex-1 items-center gap-2 self-stretch">
                {gridlines && (
                  <span className="pointer-events-none absolute inset-y-0 left-0" style={{ width: `calc(100% - ${VALUE_ROOM})` }}>
                    {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                      <span key={t} className="absolute inset-y-0 w-px bg-line-secondary" style={{ left: `${t * 100}%` }} />
                    ))}
                  </span>
                )}
                <span
                  className="relative h-4 min-w-0 shrink rounded-r-4"
                  style={{
                    width: `calc((100% - ${VALUE_ROOM}) * ${frac})`,
                    minWidth: d.value > 0 ? 2 : 0,
                    background: d.color ?? color,
                  }}
                />
                <span className="relative shrink-0 whitespace-nowrap text-12 font-medium tabular-nums text-ink">{text}</span>
              </span>
            </>
          );
          return (
            <li key={`${d.label}-${i}`} role="listitem" aria-label={d.href ? undefined : name}>
              {d.href ? (
                <Link href={d.href} aria-label={name} className="group flex items-center rounded-4 hover:bg-surface-secondary">
                  {row}
                </Link>
              ) : (
                <div className="flex items-center">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && <p className="mt-1 text-10 text-ink-muted">+{hidden} more not shown</p>}
    </div>
  );
}
