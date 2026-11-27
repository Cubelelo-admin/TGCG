'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** 'top' (default) or 'right' (used by the collapsed sidebar rail). */
  side?: 'top' | 'right';
  width?: number;
  /** Position against the viewport, measured on hover/focus, so a scrolling parent can't clip the bubble or grow a scrollbar for it. */
  fixed?: boolean;
}

/** Dark #111927 bubble with an arrow, shown on hover/focus. Always in the DOM so it can be tested. */
export function Tooltip({ content, children, side = 'top', width, fixed = false }: TooltipProps) {
  const [anchor, setAnchor] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const measure = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setAnchor(side === 'right' ? { top: r.top + r.height / 2, left: r.right + 8 } : { top: r.top - 8, left: r.left + r.width / 2 });
  };
  const pos = fixed
    ? side === 'right'
      ? 'fixed -translate-y-1/2'
      : 'fixed -translate-x-1/2 -translate-y-full'
    : side === 'right'
      ? 'absolute left-full top-1/2 ml-2 -translate-y-1/2'
      : 'absolute bottom-full left-1/2 mb-2 -translate-x-1/2';
  const arrow =
    side === 'right'
      ? 'right-full top-1/2 -translate-y-1/2 border-y-[5px] border-r-[5px] border-y-transparent border-r-ink'
      : 'left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-ink';
  return (
    <span
      className="group/tt relative inline-flex"
      onMouseEnter={fixed ? (e) => measure(e.currentTarget) : undefined}
      onFocus={fixed ? (e) => measure(e.currentTarget) : undefined}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none z-50 rounded-8 bg-ink px-3 py-2 text-12 font-medium normal-case text-white opacity-0 shadow-dock-xl transition-opacity group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 ${pos} ${
          width ? '' : 'whitespace-nowrap'
        }`}
        style={{ ...(width ? { width } : {}), ...(fixed ? anchor : {}) }}
      >
        {content}
        <span className={`absolute h-0 w-0 ${arrow}`} />
      </span>
    </span>
  );
}

/** The ⓘ icon that explains a label on hover. */
export function InfoHint({ text, width = 240 }: { text: string; width?: number }) {
  return (
    <Tooltip content={text} width={width}>
      <span tabIndex={0} aria-label={text} className="inline-flex cursor-help text-ink-tertiary">
        <Icon name="info" size={14} />
      </span>
    </Tooltip>
  );
}
