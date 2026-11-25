'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Popover } from './Popover';
import { ChecklistPanel } from './Filters';
import { Button } from './Button';
import { EmptyState } from './Layout';
import { InfoHint } from './Tooltip';
import type { SortDirection } from './helpers';

export type { SortDirection } from './helpers';
export type ColumnIconType = 'search' | 'sort' | 'filter';

export interface ColumnDef<T> {
  key: string;
  header: string;
  /** ⓘ tooltip after the header label. */
  headerHint?: string;
  render: (row: T) => ReactNode;
  /** Decorative header icon only (no behaviour). Prefer `sort`, `search` or `filter`. */
  icon?: ColumnIconType;
  align?: 'left' | 'center' | 'right';
  width?: number;
  /** ⇅ toggle; pass the column's current direction. */
  sort?: { direction: SortDirection; onToggle: () => void };
  /** Magnifier popover with a text box and Search / Reset. */
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  /** Funnel popover with a checklist. */
  filter?: { options: string[]; selected: string[]; onChange: (v: string[]) => void };
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  /** Pins the last column to the right edge (row actions). */
  stickyLastColumn?: boolean;
  /** Extra row rendered under an expanded row (e.g. variants). */
  renderExpanded?: (row: T) => ReactNode;
  expandedKeys?: string[];
  /** Scroll vertically inside the table with a sticky header. */
  maxHeight?: number;
  empty?: ReactNode;
  /** Content of a narrow trailing header cell (e.g. the Manage columns gear). */
  headerAccessory?: ReactNode;
  /** Content of the matching trailing body cell (e.g. the row ⋮ menu). */
  rowAccessory?: (row: T) => ReactNode;
  /** Minimum table width before it scrolls horizontally (default 720; use 0 inside narrow cards). */
  minWidth?: number;
}

const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' };

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  stickyLastColumn = false,
  renderExpanded,
  expandedKeys = [],
  maxHeight,
  empty,
  headerAccessory,
  rowAccessory,
  minWidth = 720,
}: DataTableProps<T>) {
  const allSelected = rows.length > 0 && selectedKeys.length === rows.length;
  const colCount = columns.length + (selectable ? 1 : 0) + (rowAccessory ? 1 : 0);

  function toggleAll() {
    onSelectionChange?.(allSelected ? [] : rows.map(rowKey));
  }

  function toggleRow(key: string) {
    if (!onSelectionChange) return;
    onSelectionChange(selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key]);
  }

  const sticky = (i: number) =>
    stickyLastColumn && i === columns.length - 1 ? 'sticky right-0 z-[1] shadow-[-8px_0_8px_-8px_rgba(16,24,40,.12)]' : '';
  const headSticky = maxHeight ? 'sticky top-0 z-[2]' : '';

  // Header row: a 1px #E5E7EB inset line under #F3F4F6; row separators only, no column lines.
  return (
    <div className="relative overflow-auto rounded-8 border border-line" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-collapse text-12" style={{ minWidth }}>
        <thead>
          <tr>
            {selectable && (
              <th className={`w-10 bg-surface-tertiary px-3 py-2.5 shadow-[inset_0_-1px_0_#E5E7EB] ${headSticky}`}>
                <input type="checkbox" className="h-4 w-4 accent-[#0D121C]" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
              </th>
            )}
            {columns.map((col, i) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                className={`bg-surface-tertiary px-3 py-2.5 text-12 font-normal text-ink-tertiary shadow-[inset_0_-1px_0_#E5E7EB] ${alignClass[col.align ?? 'left']} ${headSticky} ${sticky(i)}`}
              >
                <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-between'}`}>
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.headerHint && <InfoHint text={col.headerHint} />}
                  </span>
                  <HeaderControls col={col} />
                </div>
              </th>
            ))}
            {rowAccessory && (
              <th className={`w-12 bg-surface-tertiary px-3 py-2.5 text-ink shadow-[inset_0_-1px_0_#E5E7EB] ${headSticky}`}>{headerAccessory}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={colCount}>{empty ?? <EmptyState />}</td>
            </tr>
          )}
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = selectedKeys.includes(key);
            const expanded = renderExpanded && expandedKeys.includes(key);
            const bg = selected ? 'bg-[#EFF8FF]' : 'bg-white group-hover:bg-surface-secondary';
            return (
              <Fragment key={key}>
                <tr className="group border-t border-alpha-4">
                  {selectable && (
                    <td className={`px-3 py-2.5 ${bg}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#0D121C]"
                        checked={selected}
                        onChange={() => toggleRow(key)}
                        aria-label={`Select row ${key}`}
                      />
                    </td>
                  )}
                  {columns.map((col, i) => (
                    <td key={col.key} className={`px-3 py-2.5 align-middle text-ink ${alignClass[col.align ?? 'left']} ${bg} ${sticky(i)}`}>
                      {col.render(row)}
                    </td>
                  ))}
                  {rowAccessory && <td className={`px-3 py-2.5 text-center ${bg}`}>{rowAccessory(row)}</td>}
                </tr>
                {expanded && (
                  <tr className="border-t border-alpha-4">
                    <td colSpan={colCount} className="bg-surface-tertiary px-12 py-4">
                      {renderExpanded(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HeaderControls<T>({ col }: { col: ColumnDef<T> }) {
  return (
    <span className="flex items-center gap-1">
      {col.icon && <StaticIcon type={col.icon} />}
      {col.sort && (
        <button type="button" aria-label={`Sort by ${col.header}`} onClick={col.sort.onToggle} className="flex flex-col text-ink-muted">
          <svg viewBox="0 0 10 14" width={9} height={13} aria-hidden="true">
            <path d="M5 1l4 4H1z" fill={col.sort.direction === 'asc' ? '#111927' : '#9DA4AE'} />
            <path d="M5 13l4-4H1z" fill={col.sort.direction === 'desc' ? '#111927' : '#9DA4AE'} />
          </svg>
        </button>
      )}
      {col.search && <ColumnSearch header={col.header} search={col.search} />}
      {col.filter && (
        <Popover
          trigger={({ toggle }) => (
            <button type="button" aria-label={`Filter ${col.header}`} onClick={toggle} className={col.filter!.selected.length ? 'text-ink' : 'text-ink-muted'}>
              <Icon name="funnel" size={13} />
            </button>
          )}
        >
          {(close) => (
            <ChecklistPanel
              options={col.filter!.options}
              selected={col.filter!.selected}
              searchable={col.filter!.options.length > 6}
              onCancel={() => {
                col.filter!.onChange([]);
                close();
              }}
              onApply={(v) => {
                col.filter!.onChange(v);
                close();
              }}
            />
          )}
        </Popover>
      )}
    </span>
  );
}

function ColumnSearch({ header, search }: { header: string; search: NonNullable<ColumnDef<unknown>['search']> }) {
  const [draft, setDraft] = useState(search.value);
  return (
    <Popover
      trigger={({ toggle }) => (
        <button type="button" aria-label={`Search ${header}`} onClick={toggle} className={search.value ? 'text-ink' : 'text-ink-muted'}>
          <Icon name="search" size={13} />
        </button>
      )}
    >
      {(close) => (
        <div className="w-[240px] p-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                search.onChange(draft);
                close();
              }
            }}
            placeholder={search.placeholder ?? `Search ${header}`}
            className="h-9 w-full rounded-6 border border-line px-2 text-14 font-normal text-ink outline-hidden focus:border-ink"
          />
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="dark"
              className="flex-1"
              onClick={() => {
                search.onChange(draft);
                close();
              }}
            >
              <Icon name="search" size={14} /> Search
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1"
              onClick={() => {
                setDraft('');
                search.onChange('');
                close();
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}

function StaticIcon({ type }: { type: ColumnIconType }) {
  return <Icon name={type === 'filter' ? 'funnel' : type} size={13} className="text-ink-muted" />;
}

interface IdLinkProps {
  children: ReactNode;
  onClick?: () => void;
  /** Adds a copy-to-clipboard button after the ID. */
  copyable?: boolean;
}

/** Primary identifier in a table row (PO number, Invoice ID): 14px #1570EF with a 1px dashed underline. */
export function IdLink({ children, onClick, copyable = false }: IdLinkProps) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        className="text-14 text-link underline decoration-dashed decoration-1 underline-offset-4 hover:text-[#175CD3]"
        onClick={onClick}
      >
        {children}
      </button>
      {copyable && (
        <button
          type="button"
          aria-label={copied ? 'Copied' : 'Copy'}
          className="text-ink-muted hover:text-ink"
          onClick={() => {
            navigator.clipboard?.writeText(String(children)).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={14} />
        </button>
      )}
    </span>
  );
}
