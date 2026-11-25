/*
 * Pure values and functions shared by the DS components. They live outside the
 * "use client" component files so server components can import and call them
 * (an export of a "use client" module is only a client reference on the server).
 */

/* ---------- Field ---------- */

/** Dock text input: 36px, 1px #D2D6DB border, 6px radius, 14px, accent focus border. */
export const inputClass =
  'h-9 w-full rounded-6 border border-line bg-white px-3 text-14 text-ink outline-hidden placeholder:text-ink-muted focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-ink-muted';

/* ---------- DataTable ---------- */

export type SortDirection = 'asc' | 'desc' | null;

/** One-line sort toggle helper for screens: null → asc → desc → null. */
export function nextSort(d: SortDirection): SortDirection {
  return d === null ? 'asc' : d === 'asc' ? 'desc' : null;
}

/* ---------- Pagination ---------- */

export type PageItem = number | 'gap-start' | 'gap-end';

/** First, last, and the current page with one neighbour each side; runs of skipped pages collapse to "…". */
export function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const start = Math.max(2, Math.min(page - 1, pageCount - 4));
  const end = Math.min(pageCount - 1, Math.max(page + 1, 5));
  const items: PageItem[] = [1];
  if (start > 2) items.push('gap-start');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < pageCount - 1) items.push('gap-end');
  items.push(pageCount);
  return items;
}

/* ---------- DateRangePicker ---------- */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "23 Sept" (the portal's short form). */
export function shortDate(s: string): string {
  const d = fromISO(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "23-09-2026" (the older pages' numeric form). */
export function numericDate(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}-${m}-${y}`;
}

export function daysAgo(today: Date, n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return toISO(d);
}

/* ---------- LineChart ---------- */

// Dock chart tokens, validated (categorical, light): green, blue, orange.
export const CHART_COLORS = { green: '#079455', blue: '#1570EF', orange: '#EF6820' };

/**
 * Categorical series colours for part-to-whole charts (DonutChart), in a FIXED order: the order
 * is what keeps neighbouring slices apart for colour-blind readers (validated, light surface:
 * worst adjacent CVD ΔE 11.8, normal-vision ΔE 20.5). Assign by entity, never cycle; a 9th part
 * folds into "Other" (CHART_OTHER). Slots 2–5 sit under 3:1 on white, so a chart using them must
 * name every part in a visible legend or offer a table.
 */
export const CHART_CATEGORICAL = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647'] as const;
export const CHART_OTHER = '#9CA3AF';
