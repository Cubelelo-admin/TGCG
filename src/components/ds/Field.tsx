'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Icon } from './Icon';
import { InfoHint } from './Tooltip';
import { inputClass } from './helpers';

interface FieldLabelProps {
  label: string;
  required?: boolean;
  hint?: string;
  htmlFor?: string;
}

/** 12/16 weight-500 #384250 label with optional required star and info hint. */
export function FieldLabel({ label, required, hint, htmlFor }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1 text-12 font-medium text-ink-secondary">
      {label}
      {required && <span className="text-[#D92D20]">*</span>}
      {hint && <InfoHint text={hint} />}
    </label>
  );
}

// ComponentProps includes `ref` (React 19 passes it as a prop), so react-hook-form's register() works.
interface TextFieldProps extends ComponentProps<'input'> {
  label?: string;
  required?: boolean;
  hint?: string;
  prefix?: string;
}

export function TextField({ label, required, hint, prefix, id, className = '', ...props }: TextFieldProps) {
  const fieldId = id ?? (label ? label.toLowerCase().replace(/\W+/g, '-') : undefined);
  return (
    <div className={className}>
      {label && <FieldLabel label={label} required={required} hint={hint} htmlFor={fieldId} />}
      <div className="flex gap-2">
        {prefix && (
          <span className="flex h-9 w-20 shrink-0 items-center rounded-6 bg-surface-tertiary px-3 text-14 text-ink-muted">
            {prefix}
          </span>
        )}
        <input id={fieldId} required={required} className={inputClass} {...props} />
      </div>
    </div>
  );
}

interface TextAreaProps extends ComponentProps<'textarea'> {
  label?: string;
  required?: boolean;
}

export function TextArea({ label, required, id, className = '', ...props }: TextAreaProps) {
  const fieldId = id ?? (label ? label.toLowerCase().replace(/\W+/g, '-') : undefined);
  return (
    <div className={className}>
      {label && <FieldLabel label={label} required={required} htmlFor={fieldId} />}
      <textarea
        id={fieldId}
        required={required}
        rows={4}
        className="w-full rounded-6 border border-line bg-white px-3 py-2 text-14 text-ink outline-hidden placeholder:text-ink-muted focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-ink-muted"
        {...props}
      />
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}

/** 16px checkbox, dark when checked. */
export function Checkbox({ checked, onChange, label, disabled, ariaLabel }: CheckboxProps) {
  return (
    <label className={`inline-flex items-start gap-2 text-14 text-ink ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-px h-4 w-4 shrink-0 cursor-pointer accent-[#0D121C]"
      />
      {label && <span className="min-w-0">{label}</span>}
    </label>
  );
}

interface SearchInputProps extends Omit<ComponentProps<'input'>, 'size'> {
  /** 'md' 36px field; 'hero' 48px white field with an inline Search button. */
  size?: 'md' | 'hero';
  onSearch?: () => void;
  width?: number | string;
}

export function SearchInput({ size = 'md', onSearch, width, className = '', ...props }: SearchInputProps) {
  if (size === 'hero') {
    return (
      <div className={`flex h-12 items-center gap-2 rounded-8 bg-white pl-4 pr-2 shadow-card ${className}`} style={{ width }}>
        <input
          type="search"
          className="h-full flex-1 bg-transparent text-16 text-ink outline-hidden placeholder:text-ink-muted"
          onKeyDown={(e) => e.key === 'Enter' && onSearch?.()}
          {...props}
        />
        <button type="button" onClick={onSearch} className="h-7 rounded-6 bg-dark px-2 text-12 font-medium text-white">
          Search
        </button>
      </div>
    );
  }
  return (
    <div
      className={`flex h-9 items-center gap-2 rounded-6 border border-line px-2 focus-within:border-accent ${
        props.disabled ? 'cursor-not-allowed bg-surface-tertiary' : 'bg-white'
      } ${className}`}
      style={{ width }}
    >
      <Icon name="search" size={16} className="text-ink-muted" />
      <input
        type="search"
        className="h-full min-w-0 flex-1 bg-transparent text-14 text-ink outline-hidden placeholder:text-ink-muted disabled:cursor-not-allowed disabled:text-ink-muted"
        onKeyDown={(e) => e.key === 'Enter' && onSearch?.()}
        {...props}
      />
    </div>
  );
}
