import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface InfoCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledMessage?: string;
}

/** Settings card: 1px #D2D6DB border, 12px radius, padding 24/12; 42px icon tile inline with a 20/500 title. */
export function InfoCard({ icon, title, description, actionLabel, onClick, disabled = false, disabledMessage }: InfoCardProps) {
  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-12 border border-line px-3 py-6 transition-colors ${
        disabled ? 'cursor-not-allowed bg-surface-secondary' : 'cursor-pointer bg-white hover:border-ink-muted'
      }`}
      onClick={disabled ? undefined : onClick}
    >
      {disabled && disabledMessage && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-0 z-10 w-[240px] -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-8 bg-ink px-3 py-2 text-12 font-medium text-white opacity-0 shadow-dock-xl transition-opacity group-hover:opacity-100"
        >
          <span className="flex gap-2">
            <Icon name="info" size={14} className="mt-px" />
            {disabledMessage}
          </span>
          <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-ink" />
        </div>
      )}
      <div data-testid="info-card-body" className={`flex flex-col gap-3 ${disabled ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10.5px] bg-surface-tertiary text-ink [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {icon}
          </div>
          <h4 className="flex-1 text-20 font-medium text-ink">{title}</h4>
          {disabled ? (
            <span className="flex items-center gap-1.5 rounded-4 bg-line-secondary px-1.5 py-1 text-14 font-medium text-ink">
              <Icon name="lock" size={14} />
              Locked
            </span>
          ) : (
            <Icon name="chevronRight" size={16} className="text-ink" />
          )}
        </div>
        <p className="text-14 text-ink-tertiary">{description}</p>
        <span className="text-14 text-link">{actionLabel}</span>
      </div>
    </div>
  );
}
