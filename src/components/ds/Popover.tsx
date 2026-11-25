'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface PopoverProps {
  /** Renders the trigger; call `toggle` from its onClick. */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  /** Panel contents; call `close` to dismiss (e.g. after choosing an option). */
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  /** Panel width in px; defaults to the content's own width. */
  width?: number;
  className?: string;
  /** Start with the panel open (previews and screenshots). */
  defaultOpen?: boolean;
}

/** Dock floating panel: white, 1px #E5E7EB border, 8px radius, xl shadow. Closes on outside click and Esc. */
export function Popover({ trigger, children, align = 'left', width, className = '', defaultOpen = false }: PopoverProps) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="dialog"
          className={`absolute top-full z-50 mt-1 rounded-8 border border-line-secondary bg-white shadow-dock-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={width ? { width } : undefined}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  trailing?: ReactNode;
  danger?: boolean;
}

/** 36px menu row: padding 8/12, 4px radius, 14px text. */
export function MenuItem({ children, icon, onClick, active = false, trailing, danger = false }: MenuItemProps) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-3 rounded-4 px-3 text-left text-14 hover:bg-surface-tertiary ${
        active ? 'bg-surface-tertiary font-medium' : ''
      } ${danger ? 'text-[#D92D20]' : 'text-ink'}`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

export function Menu({ children }: { children: ReactNode }) {
  return (
    <div role="menu" className="flex flex-col p-1.5">
      {children}
    </div>
  );
}
