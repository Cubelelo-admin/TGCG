'use client';

import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Popover, Menu, MenuItem } from './Popover';
import { RoleBadge } from './RoleBadge';

export interface OrgOption {
  name: string;
  role: string;
  /** Value passed to onSwitchOrg instead of `name` (e.g. an event slug). */
  id?: string;
}

interface TopbarProps {
  orgName: string;
  roleBadge?: ReactNode;
  /** Orgs the user can switch between; the menu groups them under `orgGroupLabel`. */
  orgs?: OrgOption[];
  orgGroupLabel?: string;
  /** Called with the chosen org's `id` (or its `name` when it has no id). */
  onSwitchOrg?: (name: string) => void;
  userName: string;
  userInitial: string;
  userEmail?: string;
  userPhone?: string;
  onLogout?: () => void;
}

function Avatar({ initial, size = 24 }: { initial: string; size?: number }) {
  return (
    <span
      data-testid="avatar"
      className="flex shrink-0 items-center justify-center rounded-full border border-line-secondary bg-white text-12 text-ink"
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  );
}

/** 53px white bar, 1px #E5E7EB bottom border: org switcher on the left, user menu on the right. */
export function Topbar({ orgName, roleBadge, orgs, orgGroupLabel = 'Organisations', onSwitchOrg, userName, userInitial, userEmail, userPhone, onLogout }: TopbarProps) {
  return (
    <div className="flex h-[53px] shrink-0 items-center justify-between border-b border-line-secondary bg-white px-4 py-2">
      <Popover
        trigger={({ open, toggle }) => (
          <button
            type="button"
            aria-label="Switch organisation"
            onClick={toggle}
            className={`flex h-[33px] items-center gap-2 rounded-8 px-2 py-1.5 ${open ? 'bg-surface-secondary' : 'hover:bg-surface-secondary'}`}
          >
            <span className="text-14 font-medium text-ink">{orgName}</span>
            {roleBadge}
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} className="text-ink" />
          </button>
        )}
      >
        {(close) => (
          <div className="w-[320px] p-1.5">
            <p className="px-3 py-1.5 text-12 font-medium uppercase tracking-wide text-ink-muted">{orgGroupLabel}</p>
            <Menu>
              {(orgs ?? [{ name: orgName, role: '' }]).map((o: OrgOption) => (
                <MenuItem
                  key={o.id ?? o.name}
                  active={o.name === orgName}
                  trailing={o.role ? <RoleBadge>{o.role}</RoleBadge> : undefined}
                  onClick={() => {
                    onSwitchOrg?.(o.id ?? o.name);
                    close();
                  }}
                >
                  {o.name}
                </MenuItem>
              ))}
            </Menu>
          </div>
        )}
      </Popover>

      <Popover
        align="right"
        trigger={({ open, toggle }) => (
          <button type="button" aria-label="Account menu" onClick={toggle} className="flex h-9 items-center gap-2 rounded-8 px-2 hover:bg-surface-secondary">
            <Avatar initial={userInitial} />
            <span className="text-14 font-medium text-ink">{userName}</span>
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} className="text-ink" />
          </button>
        )}
      >
        {(close) => (
          <div className="w-[322px] p-1.5">
            <div className="flex items-center gap-1.5 rounded-4 bg-surface-tertiary px-3 py-1.5">
              <Avatar initial={userInitial} size={32} />
              <div className="ml-1.5 min-w-0">
                <p className="text-14 font-medium text-ink">{userName}</p>
                {userEmail && <p className="truncate text-12 text-ink-tertiary">{userEmail}</p>}
                {userPhone && <p className="text-12 text-ink-tertiary">{userPhone}</p>}
              </div>
            </div>
            <div className="my-1.5 h-px bg-line-secondary" />
            <MenuItem
              icon={<Icon name="logout" size={16} className="text-ink-tertiary" />}
              onClick={() => {
                onLogout?.();
                close();
              }}
            >
              Logout
            </MenuItem>
          </div>
        )}
      </Popover>
    </div>
  );
}
