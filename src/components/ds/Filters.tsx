'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { Checkbox } from './Field';
import { Popover, Menu, MenuItem } from './Popover';

/* ---------- ChecklistPanel ---------- */

interface ChecklistPanelProps {
  options: string[];
  selected: string[];
  onApply: (selected: string[]) => void;
  onCancel?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}

/** Searchable checkbox list with Clear all / Apply (quick-filter chips, column filters). */
export function ChecklistPanel({ options, selected, onApply, onCancel, searchable = false, searchPlaceholder = 'Search...' }: ChecklistPanelProps) {
  const [draft, setDraft] = useState<string[]>(selected);
  const [query, setQuery] = useState('');
  const shown = query ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : options;
  const toggle = (o: string) => setDraft((d) => (d.includes(o) ? d.filter((x) => x !== o) : [...d, o]));

  return (
    <div className="w-[288px]">
      {searchable && (
        <div className="p-2 pb-0">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-6 border border-line px-2 text-14 outline-hidden focus:border-ink"
          />
        </div>
      )}
      <div className="flex max-h-56 flex-col gap-3 overflow-y-auto px-3 py-3">
        {shown.map((o) => (
          <Checkbox key={o} checked={draft.includes(o)} onChange={() => toggle(o)} label={o} />
        ))}
        {shown.length === 0 && <p className="text-14 text-ink-muted">No matches</p>}
      </div>
      <div className="flex gap-2 border-t border-line-secondary p-2">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={() => {
            setDraft([]);
            onCancel?.();
          }}
        >
          Clear all
        </Button>
        <Button type="button" size="sm" variant="dark" className="flex-1" disabled={sameSet(draft, selected)} onClick={() => onApply(draft)}>
          Apply
        </Button>
      </div>
    </div>
  );
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/* ---------- FilterPanel (two-pane) ---------- */

export interface FilterGroup {
  key: string;
  label: string;
  options: string[];
}

interface FilterPanelProps {
  groups: FilterGroup[];
  value: Record<string, string[]>;
  onApply: (value: Record<string, string[]>) => void;
  onCancel: () => void;
}

/** Categories on the left (with selected-count bubbles), a searchable checklist on the right. */
export function FilterPanel({ groups, value, onApply, onCancel }: FilterPanelProps) {
  const [active, setActive] = useState(groups[0]?.key);
  const [draft, setDraft] = useState<Record<string, string[]>>(value);
  const [query, setQuery] = useState('');
  const group = groups.find((g) => g.key === active)!;
  const sel = draft[active] ?? [];
  const shown = query ? group.options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : group.options;

  return (
    <div className="w-[456px] px-3">
      <div className="flex h-[400px]">
        <ul className="w-[180px] shrink-0 border-r border-line-secondary py-1 pr-3">
          {groups.map((g) => {
            const n = (draft[g.key] ?? []).length;
            return (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(g.key);
                    setQuery('');
                  }}
                  className={`my-1 flex h-10 w-full items-center justify-between rounded-8 px-4 text-left text-14 ${
                    g.key === active ? 'bg-surface-tertiary font-semibold text-ink' : 'text-ink-tertiary hover:bg-surface-secondary'
                  }`}
                >
                  {g.label}
                  {n > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-10 text-white">{n}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex min-w-0 flex-1 flex-col py-1 pl-3">
          <div className="flex h-9 items-center gap-2 rounded-6 border border-line px-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${group.label}`}
              className="min-w-0 flex-1 text-14 outline-hidden placeholder:text-ink-muted"
            />
            <Icon name="search" size={16} className="text-ink-muted" />
          </div>
          <div className="mt-3 flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {shown.map((o) => (
              <Checkbox
                key={o}
                checked={sel.includes(o)}
                label={o}
                onChange={() =>
                  setDraft((d) => ({ ...d, [active]: sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o] }))
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line-secondary py-3">
        <button type="button" onClick={() => setDraft({})} className="flex items-center gap-2 text-14 text-[#D92D20]">
          <Icon name="trash" size={16} />
          <span className="underline decoration-dashed underline-offset-2">Clear all filters</span>
        </button>
        <div className="flex gap-2">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="dark" onClick={() => onApply(draft)}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Outline "Filters" button with the applied-count bubble, opening the two-pane panel. */
export function FiltersButton({ groups, value, onApply, label = 'Filters' }: { groups: FilterGroup[]; value: Record<string, string[]>; onApply: (v: Record<string, string[]>) => void; label?: string }) {
  const count = Object.values(value).filter((v) => v.length > 0).length;
  return (
    <Popover
      trigger={({ toggle }) => (
        <Button type="button" onClick={toggle}>
          <Icon name="filter" size={16} />
          {label}
          {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-10 text-white">{count}</span>}
        </Button>
      )}
    >
      {(close) => (
        <FilterPanel
          groups={groups}
          value={value}
          onCancel={close}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Popover>
  );
}

/* ---------- ManageColumns ---------- */

export interface ColumnChoice {
  key: string;
  label: string;
  visible: boolean;
  locked?: boolean;
}

/** Gear popover: drag to reorder, tick to show/hide, Reset / Save View. */
export function ManageColumns({ columns, onSave, defaults }: { columns: ColumnChoice[]; defaults: ColumnChoice[]; onSave: (c: ColumnChoice[]) => void }) {
  return (
    <Popover
      align="right"
      trigger={({ toggle }) => (
        <button type="button" aria-label="Manage columns" onClick={toggle} className="text-ink hover:text-ink-tertiary">
          <Icon name="gear" size={16} />
        </button>
      )}
    >
      {(close) => (
        <ManageColumnsPanel
          columns={columns}
          defaults={defaults}
          onSave={(c) => {
            onSave(c);
            close();
          }}
        />
      )}
    </Popover>
  );
}

function ManageColumnsPanel({ columns, defaults, onSave }: { columns: ColumnChoice[]; defaults: ColumnChoice[]; onSave: (c: ColumnChoice[]) => void }) {
  const [draft, setDraft] = useState(columns);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  function drop(to: number) {
    if (dragFrom === null || dragFrom === to || draft[to].locked) return;
    const next = [...draft];
    const [moved] = next.splice(dragFrom, 1);
    next.splice(to, 0, moved);
    setDraft(next);
    setDragFrom(null);
  }

  return (
    <div className="w-[256px] p-4">
      <p className="mb-3 text-12 font-medium uppercase tracking-wide text-ink-muted">Manage columns</p>
      <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {draft.map((c, i) => (
          <li
            key={c.key}
            draggable={!c.locked}
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(i)}
            className="flex h-9 items-center gap-2"
          >
            <span className={c.locked ? 'text-line' : 'cursor-grab text-ink-tertiary'}>
              <Icon name="drag" size={16} strokeWidth={3} />
            </span>
            <Checkbox
              checked={c.visible}
              disabled={c.locked}
              label={c.label}
              onChange={(v) => setDraft((d) => d.map((x) => (x.key === c.key ? { ...x, visible: v } : x)))}
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end gap-2 border-t border-line-secondary pt-3">
        <Button type="button" size="sm" onClick={() => setDraft(defaults)}>
          Reset
        </Button>
        <Button type="button" size="sm" variant="dark" onClick={() => onSave(draft)}>
          Save View
        </Button>
      </div>
    </div>
  );
}

/* ---------- RowMenu ---------- */

export interface RowMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

/** ⋮ button opening a small action menu, right-aligned. */
export function RowMenu({ items, label = 'Row actions', trigger }: { items: RowMenuItem[]; label?: string; trigger?: (toggle: () => void) => ReactNode }) {
  return (
    <Popover
      align="right"
      trigger={({ toggle }) =>
        trigger ? (
          <>{trigger(toggle)}</>
        ) : (
          <button type="button" aria-label={label} onClick={toggle} className="flex h-7 w-7 items-center justify-center rounded-4 text-ink hover:bg-surface-tertiary">
            <Icon name="dots" size={18} strokeWidth={3} />
          </button>
        )
      }
    >
      {(close) => (
        <div className="w-[200px]">
          <Menu>
            {items.map((it) => (
              <MenuItem
                key={it.label}
                icon={it.icon}
                onClick={() => {
                  it.onClick();
                  close();
                }}
              >
                {it.label}
              </MenuItem>
            ))}
          </Menu>
        </div>
      )}
    </Popover>
  );
}
