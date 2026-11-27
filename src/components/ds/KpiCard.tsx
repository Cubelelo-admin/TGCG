import type { ReactNode } from 'react';
import { InfoHint } from './Tooltip';

export type KpiTone = 'default' | 'green' | 'pink' | 'white' | 'bordered' | 'orange' | 'blue' | 'red' | 'grey';

interface KpiSub {
  label: string;
  value: ReactNode;
}

interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  tone?: KpiTone;
  sub?: KpiSub[];
  /** Small line under the value (e.g. "Total spend on all of your products…"). */
  caption?: ReactNode;
  /** ⓘ tooltip after the label. */
  hint?: string;
  /** Upper-case label (Score Card tiles). */
  eyebrow?: boolean;
  /** Clickable filter card: the selected one gets the stronger fill, a border and a lift. */
  onClick?: () => void;
  selected?: boolean;
  /** Always use the stronger fill (the portal's Invoice Rejected card). */
  strong?: boolean;
}

// Fills measured on the portal's Invoice Summary (selected cards are one step stronger).
const toneClasses: Record<KpiTone, { base: string; selected: string }> = {
  default: { base: '', selected: 'bg-surface-tertiary' },
  green: { base: 'bg-[#DDF5E1]', selected: 'bg-[#C2F7CB]' },
  pink: { base: 'bg-[#F9E0E0]', selected: 'bg-[#FBD2D2]' },
  white: { base: 'bg-white shadow-card', selected: 'bg-white' },
  bordered: { base: 'border border-line-secondary bg-white', selected: 'bg-white' },
  // Dock soft-tint family (the status-pill tints; selected = the next step up the same ramp).
  orange: { base: 'bg-tint-orange', selected: 'bg-[#F9DBAF]' },
  blue: { base: 'bg-tint-blue', selected: 'bg-[#B2DDFF]' },
  red: { base: 'bg-tint-red', selected: 'bg-[#FECDCA]' },
  grey: { base: 'bg-tint-grey', selected: 'bg-[#E5E7EB]' },
};

export function KpiCard({ label, value, tone = 'default', sub, caption, hint, eyebrow = false, onClick, selected = false, strong = false }: KpiCardProps) {
  const t = toneClasses[tone];
  const lift = selected
    ? `${t.selected} border border-[#D4D4D8] shadow-[0_10px_15px_-3px_rgba(0,0,0,.1),0_4px_6px_-2px_rgba(0,0,0,.05)]`
    : strong
      ? t.selected
      : t.base;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      aria-pressed={onClick ? selected : undefined}
      onClick={onClick}
      className={`flex min-h-[140px] min-w-0 flex-1 flex-col justify-center rounded-16 p-4 text-left ${lift} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`mb-1 flex items-center gap-1 text-14 font-medium text-ink ${eyebrow ? 'uppercase' : ''}`}>
        {label}
        {hint && <InfoHint text={hint} />}
      </div>
      <div className="text-32 font-semibold tabular-nums text-ink">{value}</div>
      {caption && <div className="mt-1 text-10 text-ink-tertiary">{caption}</div>}
      {sub && (
        <div className="-mx-4 -mb-4 mt-3 grid grid-cols-2 border-t border-[rgba(255,255,255,.7)]">
          {sub.map((s, i) => (
            <span key={s.label} className={`px-4 py-2 text-14 font-medium text-ink ${i > 0 ? 'border-l border-[rgba(255,255,255,.7)]' : ''}`}>
              {s.label}
              <b className="block font-normal">{s.value}</b>
            </span>
          ))}
        </div>
      )}
    </Tag>
  );
}

interface KpiRowProps {
  children: ReactNode;
}

export function KpiRow({ children }: KpiRowProps) {
  return <div className="mb-4 flex flex-wrap items-stretch gap-4">{children}</div>;
}

export function KpiDivider() {
  return <div className="my-6 w-px self-stretch bg-ink-tertiary" />;
}
