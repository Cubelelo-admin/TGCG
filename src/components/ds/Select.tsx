'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Popover, MenuItem, Menu } from './Popover';
import { FieldLabel } from './Field';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  icon?: ReactNode;
  /** Adds a search box above the options (long lists such as facilities). */
  searchable?: boolean;
  disabled?: boolean;
  width?: number;
  ariaLabel?: string;
  /** Start with the options showing (previews and screenshots). */
  defaultOpen?: boolean;
}

/** 36px select: 1px #D2D6DB border, 6px radius, padding 6/8, chevron right; options in a Dock popover. */
export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select',
  label,
  required,
  icon,
  searchable = false,
  disabled = false,
  width,
  ariaLabel,
  defaultOpen = false,
}: SelectProps) {
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const shown = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;

  return (
    <div style={{ width }}>
      {label && <FieldLabel label={label} required={required} />}
      <Popover
        className="w-full"
        width={width}
        defaultOpen={defaultOpen}
        trigger={({ open, toggle }) => (
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel ?? label ?? placeholder}
            aria-expanded={open}
            onClick={toggle}
            className={`flex h-9 w-full items-center gap-2 rounded-6 border bg-white px-2 text-left text-14 disabled:cursor-not-allowed disabled:bg-surface-tertiary ${
              open ? 'border-ink' : 'border-line'
            }`}
          >
            {icon && <span className="text-ink-tertiary">{icon}</span>}
            <span className={`min-w-0 flex-1 truncate ${selected ? 'text-ink' : 'text-ink-muted'}`}>
              {selected ? selected.label : placeholder}
            </span>
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} className="text-ink-tertiary" />
          </button>
        )}
      >
        {(close) => (
          <div className="min-w-[180px]">
            {searchable && (
              <div className="border-b border-line-secondary p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="h-8 w-full rounded-6 border border-line px-2 text-14 outline-hidden focus:border-accent"
                />
              </div>
            )}
            <div className="max-h-64 overflow-y-auto">
              <Menu>
                {shown.map((o) => (
                  <MenuItem
                    key={o.value}
                    active={o.value === value}
                    onClick={() => {
                      onChange(o.value);
                      setQuery('');
                      close();
                    }}
                  >
                    {o.label}
                  </MenuItem>
                ))}
                {shown.length === 0 && <p className="px-3 py-2 text-14 text-ink-muted">No matches</p>}
              </Menu>
            </div>
          </div>
        )}
      </Popover>
    </div>
  );
}
