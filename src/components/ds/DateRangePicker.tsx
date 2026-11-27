'use client';

import { useState } from 'react';
import { Icon } from './Icon';
import { Popover, Menu, MenuItem } from './Popover';
import { MONTHS, daysAgo, fromISO, numericDate, shortDate, toISO } from './helpers';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface RangeCalendarProps {
  value: DateRange | null;
  onChange: (range: DateRange) => void;
  /** First of the left-hand month shown. */
  month: Date;
  onMonthChange: (month: Date) => void;
  maxDate?: string;
}

/** Two months side by side; first click sets the start, second sets the end. */
export function RangeCalendar({ value, onChange, month, onMonthChange, maxDate }: RangeCalendarProps) {
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const shift = (n: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + n, 1));

  function pick(iso: string) {
    if (!pendingStart) {
      setPendingStart(iso);
      return;
    }
    const [a, b] = pendingStart <= iso ? [pendingStart, iso] : [iso, pendingStart];
    setPendingStart(null);
    onChange({ start: a, end: b });
  }

  const start = pendingStart ?? value?.start;
  const end = pendingStart ? null : value?.end;

  return (
    <div className="flex gap-6 p-4">
      {[0, 1].map((offset) => {
        const m = new Date(month.getFullYear(), month.getMonth() + offset, 1);
        const lead = m.getDay();
        const daysIn = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
        const cells: (string | null)[] = [...Array(lead).fill(null)];
        for (let d = 1; d <= daysIn; d++) cells.push(toISO(new Date(m.getFullYear(), m.getMonth(), d)));
        return (
          <div key={offset} className="w-[252px]">
            <div className="mb-2 flex h-8 items-center justify-between">
              {offset === 0 ? (
                <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="text-ink-tertiary hover:text-ink">
                  <Icon name="chevronLeft" size={16} />
                </button>
              ) : (
                <span className="w-4" />
              )}
              <span className="text-14 font-medium text-ink">
                {MONTHS[m.getMonth()]} {m.getFullYear()}
              </span>
              {offset === 1 ? (
                <button type="button" aria-label="Next month" onClick={() => shift(1)} className="text-ink-tertiary hover:text-ink">
                  <Icon name="chevronRight" size={16} />
                </button>
              ) : (
                <span className="w-4" />
              )}
            </div>
            <div className="grid grid-cols-7 text-center text-12">
              {DAYS.map((d) => (
                <span key={d} className="py-1 text-ink-muted">
                  {d}
                </span>
              ))}
              {cells.map((iso, i) => {
                if (!iso) return <span key={`e${i}`} />;
                const disabled = !!maxDate && iso > maxDate;
                const isEdge = iso === start || iso === end;
                const inRange = !!start && !!end && iso > start && iso < end;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    aria-label={iso}
                    aria-pressed={isEdge}
                    onClick={() => pick(iso)}
                    className={`h-8 text-12 ${
                      isEdge
                        ? 'rounded-4 bg-dark font-medium text-white'
                        : inRange
                          ? 'bg-surface-tertiary text-ink'
                          : 'rounded-4 text-ink hover:bg-surface-secondary'
                    } disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent`}
                  >
                    {Number(iso.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface RangePreset {
  label: string;
  days: number;
}

const DEFAULT_PRESETS: RangePreset[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', days: 90 },
  { label: 'Last 12 months', days: 365 },
];

interface DateRangePickerProps {
  value: DateRange | null;
  onChange: (range: DateRange) => void;
  /**
   * 'presets' (PO Summary): a select-style button opening a preset menu with "Custom ›" for the calendar.
   * 'fields' (Invoices, Consumer Offers): start → end fields opening the calendar directly, quick ranges below.
   */
  variant?: 'presets' | 'fields';
  presets?: RangePreset[];
  placeholder?: [string, string];
  /** Defaults to the current date (read once, on mount). */
  today?: Date;
  /** Start with the panel open (previews and screenshots). */
  defaultOpen?: boolean;
}

export function DateRangePicker({
  value,
  onChange,
  variant = 'presets',
  presets = DEFAULT_PRESETS,
  placeholder = ['Start date', 'End date'],
  today: todayProp,
  defaultOpen = false,
}: DateRangePickerProps) {
  // Read the clock once (lazy state initialiser) so renders stay pure.
  const [mountedToday] = useState(() => new Date());
  const today = todayProp ?? mountedToday;
  const [custom, setCustom] = useState(variant === 'fields');
  const [month, setMonth] = useState(() => {
    const base = value ? fromISO(value.end) : today;
    return new Date(base.getFullYear(), base.getMonth() - 1, 1);
  });
  const todayISO = toISO(today);
  const applyPreset = (p: RangePreset) => onChange({ start: daysAgo(today, p.days), end: todayISO });

  return (
    <Popover
      align={variant === 'presets' ? 'right' : 'left'}
      defaultOpen={defaultOpen}
      trigger={({ open, toggle }) =>
        variant === 'presets' ? (
          <button
            type="button"
            aria-label="Date range"
            onClick={() => {
              setCustom(false);
              toggle();
            }}
            className={`flex h-9 items-center gap-2 rounded-6 border bg-white px-2 text-14 text-ink ${open ? 'border-ink' : 'border-line'}`}
          >
            <Icon name="calendar" size={16} className="text-ink-tertiary" />
            {value ? `${shortDate(value.start)} - ${shortDate(value.end)}` : placeholder[0]}
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} className="text-ink-tertiary" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Date range"
            onClick={toggle}
            className={`flex h-9 w-[288px] items-center gap-3 rounded-6 border bg-white px-3 text-14 ${open ? 'border-ink' : 'border-line'}`}
          >
            <span className={`flex-1 text-left ${value ? 'text-ink' : 'text-ink-muted'}`}>{value ? numericDate(value.start) : placeholder[0]}</span>
            <Icon name="arrowRight" size={14} className="text-ink-muted" />
            <span className={`flex-1 text-left ${value ? 'text-ink' : 'text-ink-muted'}`}>{value ? numericDate(value.end) : placeholder[1]}</span>
            <Icon name="calendar" size={16} className="text-ink-tertiary" />
          </button>
        )
      }
    >
      {(close) =>
        custom ? (
          <div>
            <RangeCalendar
              value={value}
              month={month}
              onMonthChange={setMonth}
              maxDate={todayISO}
              onChange={(r) => {
                onChange(r);
                close();
              }}
            />
            <div className="flex flex-wrap gap-2 border-t border-line-secondary px-4 py-3">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    applyPreset(p);
                    close();
                  }}
                  className="h-7 rounded-full bg-line-secondary px-3 text-12 text-ink hover:bg-line"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-[172px]">
            <Menu>
              {presets.map((p) => (
                <MenuItem
                  key={p.label}
                  onClick={() => {
                    applyPreset(p);
                    close();
                  }}
                >
                  {p.label}
                </MenuItem>
              ))}
              <MenuItem trailing={<Icon name="chevronRight" size={14} />} onClick={() => setCustom(true)}>
                Custom
              </MenuItem>
            </Menu>
          </div>
        )
      }
    </Popover>
  );
}
