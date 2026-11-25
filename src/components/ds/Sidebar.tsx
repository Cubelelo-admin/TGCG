'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

export interface NavItemDef {
  key: string;
  label: string;
  icon: ReactNode;
  /** Route to navigate to. When set the row renders as a next/link <Link> (onSelect still fires on click). */
  href?: string;
}

interface SidebarProps {
  items: NavItemDef[];
  activeKey: string;
  /** Called with the item key on click/Enter. Optional when every item has an `href`. */
  onSelect?: (key: string) => void;
  bottomItems?: NavItemDef[];
  logo?: ReactNode;
  brandName?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/** 255px nav (54px icon rail when collapsed). The logo row is 53px so it lines up with the topbar. */
export function Sidebar({ items, activeKey, onSelect, bottomItems, logo, brandName, collapsed = false, onToggleCollapse }: SidebarProps) {
  return (
    <nav
      aria-label="Main navigation"
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line-secondary bg-white transition-[width] ${
        collapsed ? 'w-[54px]' : 'w-[255px]'
      }`}
    >
      {(logo || brandName || onToggleCollapse) && (
        <div className={`flex h-[53px] shrink-0 items-center border-b border-line-secondary ${collapsed ? 'justify-center' : 'justify-between px-2'}`}>
          {collapsed && onToggleCollapse ? (
            <button type="button" aria-label="Expand sidebar" onClick={onToggleCollapse} className="flex">
              {logo}
            </button>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              {logo}
              {brandName && <span className="truncate text-18 font-medium text-ink">{brandName}</span>}
            </div>
          )}
          {!collapsed && onToggleCollapse && (
            <button
              type="button"
              aria-label="Collapse sidebar"
              onClick={onToggleCollapse}
              className="flex h-7 w-7 items-center justify-center rounded-full text-dark hover:bg-surface-tertiary"
            >
              <Icon name="sidebar" size={18} />
            </button>
          )}
        </div>
      )}
      <div className={`flex-1 overflow-y-auto ${collapsed ? 'px-2 py-3' : 'p-2 pt-3'}`}>
        {items.map((item) => (
          <NavRow key={item.key} item={item} active={item.key === activeKey} onSelect={onSelect} collapsed={collapsed} />
        ))}
        {bottomItems && (
          <>
            <div className="mx-1 my-2 h-px bg-line-secondary" />
            {bottomItems.map((item) => (
              <NavRow key={item.key} item={item} active={item.key === activeKey} onSelect={onSelect} collapsed={collapsed} />
            ))}
          </>
        )}
      </div>
    </nav>
  );
}

function NavRow({ item, active, onSelect, collapsed }: { item: NavItemDef; active: boolean; onSelect?: (key: string) => void; collapsed: boolean }) {
  // The active item is marked by a neutral translucent fill only; no brand accent.
  const className = `mb-1 flex h-[34px] cursor-pointer items-center gap-2 rounded-6 text-14 ${collapsed ? 'w-[38px] justify-center' : 'px-2.5 py-2'} ${
    active ? 'bg-alpha-8 text-ink' : 'text-ink-tertiary hover:bg-alpha-4'
  }`;
  const content = (
    <>
      <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{item.icon}</span>
      {!collapsed && item.label}
    </>
  );
  const row = item.href ? (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={className}
      onClick={() => onSelect?.(item.key)}
    >
      {content}
    </Link>
  ) : (
    <div
      role="link"
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      tabIndex={0}
      className={className}
      onClick={() => onSelect?.(item.key)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.(item.key)}
    >
      {content}
    </div>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right" fixed>
      {row}
    </Tooltip>
  ) : (
    row
  );
}
