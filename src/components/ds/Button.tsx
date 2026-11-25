import type { ButtonHTMLAttributes } from 'react';

/**
 * 'dark' (primary) and 'outline' are the spec's two buttons. The tinted variants are the Dock
 * soft-tint family (the status-pill fills) for secondary actions that carry meaning:
 * 'green' (e.g. WhatsApp resend), 'orange' (money actions such as Mark paid), 'blue' (info),
 * 'red' (destructive).
 */
export type ButtonVariant = 'dark' | 'outline' | 'green' | 'orange' | 'blue' | 'red';
export type ButtonSize = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  'inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap border disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-tertiary disabled:text-ink-disabled';

const sizes: Record<ButtonSize, string> = {
  md: 'h-9 rounded-6 px-2.5 py-2 text-14',
  sm: 'h-7 rounded-4 px-2 py-1 text-12',
};

// Tinted variants: tint fill + on-tint text, border one step up the same ramp; hover fills with
// that step and darkens the border one more. The disabled: classes win over hover: (later variant).
const variants: Record<ButtonVariant, string> = {
  dark: 'bg-dark text-white border-dark hover:bg-ink',
  outline: 'bg-white text-dark border-dark hover:bg-surface-secondary',
  green: 'bg-tint-green text-on-tint-green border-[#ABEFC6] hover:bg-[#ABEFC6] hover:border-[#75E0A7]',
  orange: 'bg-tint-orange text-on-tint-orange border-[#F9DBAF] hover:bg-[#F9DBAF] hover:border-[#F7B27A]',
  blue: 'bg-tint-blue text-on-tint-blue border-[#B2DDFF] hover:bg-[#B2DDFF] hover:border-[#84CAFF]',
  red: 'bg-tint-red text-on-tint-red border-[#FECDCA] hover:bg-[#FECDCA] hover:border-[#FDA29B]',
};

/**
 * Class string for a Button look on another element (e.g. a next/link <Link> or an <a download>),
 * so links that act as buttons match exactly. Server-safe.
 */
export function buttonClass({ variant = 'outline', size = 'md', className = '' }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `${base} ${sizes[size]} ${variants[variant]} ${className}`;
}

export function Button({ variant = 'outline', size = 'md', className = '', ...props }: ButtonProps) {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}
