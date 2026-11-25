'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Icon, type IconName } from './Icon';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  icon?: IconName;
  /** Icon-only segment: the label becomes the accessible name and a tooltip. */
  hideLabel?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group (e.g. "View by category as"). */
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}

const sizes = {
  sm: { item: 'h-6 px-2 text-12 gap-1', icon: 14 },
  md: { item: 'h-8 px-3 text-14 gap-1.5', icon: 16 },
};

/**
 * Compact Dock segmented control: white outlined track, the selected segment in neutral grey
 * (#E5E7EB, the pending-pill grey; never the accent). Radio-group semantics with a roving
 * tabindex: Tab focuses the selected segment, arrow keys / Home / End move and select.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, size = 'sm', className = '' }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = sizes[size];
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  function move(e: KeyboardEvent<HTMLButtonElement>, from: number) {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (from + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (from - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(options[next].value);
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`inline-flex shrink-0 items-center gap-0.5 rounded-6 border border-line bg-white p-0.5 ${className}`}>
      {options.map((o, i) => {
        const selected = i === current;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.hideLabel ? o.label : undefined}
            title={o.hideLabel ? o.label : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => move(e, i)}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-4 font-medium ${s.item} ${
              selected ? 'bg-line-secondary text-ink' : 'text-ink-muted hover:bg-surface-secondary hover:text-ink'
            }`}
          >
            {o.icon && <Icon name={o.icon} size={s.icon} />}
            {!o.hideLabel && o.label}
          </button>
        );
      })}
    </div>
  );
}

export type ChartTableView = 'chart' | 'table';

const VIEW_OPTIONS: SegmentOption<ChartTableView>[] = [
  { value: 'chart', label: 'Chart', icon: 'chart' },
  { value: 'table', label: 'Table', icon: 'table' },
];

interface ViewToggleProps {
  value: ChartTableView;
  onChange: (value: ChartTableView) => void;
  /** Accessible name, e.g. "By category view". Default "View as". */
  ariaLabel?: string;
  size?: 'sm' | 'md';
  /** Icons only (labels become tooltips / accessible names). */
  iconOnly?: boolean;
  className?: string;
}

/** Chart | Table preset of SegmentedControl. */
export function ViewToggle({ value, onChange, ariaLabel = 'View as', size = 'sm', iconOnly = false, className }: ViewToggleProps) {
  const options = iconOnly ? VIEW_OPTIONS.map((o) => ({ ...o, hideLabel: true })) : VIEW_OPTIONS;
  return <SegmentedControl options={options} value={value} onChange={onChange} ariaLabel={ariaLabel} size={size} className={className} />;
}
