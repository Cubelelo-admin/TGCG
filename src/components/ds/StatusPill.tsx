import type { ReactNode } from 'react';

export type StatusTone = 'expired' | 'active' | 'pending' | 'warning' | 'info';

interface StatusPillProps {
  tone: StatusTone;
  children: ReactNode;
}

const toneClasses: Record<StatusTone, string> = {
  expired: 'bg-tint-red text-on-tint-red',
  active: 'bg-tint-green text-on-tint-green',
  pending: 'bg-line-secondary text-ink',
  warning: 'bg-tint-orange text-on-tint-orange',
  info: 'bg-tint-blue text-on-tint-blue',
};

/** Soft-tint status label: 12px weight 500, 4px radius, padding 4/6. Case comes from the label itself. */
export function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-4 px-1.5 py-1 text-12 font-medium ${toneClasses[tone]}`}>{children}</span>
  );
}
