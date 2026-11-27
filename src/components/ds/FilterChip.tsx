import type { ReactNode } from 'react';

interface FilterChipProps {
  active?: boolean;
  count?: number;
  onClick?: () => void;
  children: ReactNode;
}

/** 28px full pill: #E5E7EB, padding 6/8, 12px #111927; active = #0D121C. */
export function FilterChip({ active = false, count, onClick, children }: FilterChipProps) {
  const base = 'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-12';
  const state = active ? 'bg-dark text-white' : 'bg-line-secondary text-ink hover:bg-line';

  return (
    <button type="button" aria-pressed={active} className={`${base} ${state}`} onClick={onClick}>
      {children}
      {count !== undefined && (
        <span
          data-testid="chip-count"
          className={`min-w-4 rounded-full px-1 text-center text-10 ${active ? 'bg-white text-ink' : 'bg-ink text-white'}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
