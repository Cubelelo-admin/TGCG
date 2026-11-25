'use client';

import { Icon } from './Icon';
import { Popover, Menu, MenuItem } from './Popover';
import { pageItems } from './helpers';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** Adds an "Items in page" selector on the right. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}

const navButton =
  'flex h-9 w-9 items-center justify-center rounded-6 text-dark hover:bg-surface-secondary disabled:text-ink-disabled disabled:hover:bg-transparent';

export function Pagination({ page, pageSize, totalItems, onPageChange, pageSizeOptions, onPageSizeChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const first = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-3">
      <span className="text-14 text-ink-muted">
        {first}-{last} of {totalItems} items
      </span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="First page" className={navButton} onClick={() => onPageChange(1)} disabled={page <= 1}>
          <Icon name="chevronsLeft" size={16} />
        </button>
        <button type="button" aria-label="Previous page" className={navButton} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <Icon name="chevronLeft" size={16} />
        </button>
        {pageItems(page, pageCount).map((item) =>
          typeof item === 'number' ? (
            <button
              type="button"
              key={item}
              aria-label={String(item)}
              aria-current={item === page ? 'page' : undefined}
              className={`flex h-8 min-w-8 items-center justify-center rounded-4 px-1.5 text-14 text-ink ${
                item === page ? 'bg-surface-tertiary' : 'hover:bg-surface-secondary'
              }`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="flex h-8 w-8 items-center justify-center text-14 text-ink">
              …
            </span>
          )
        )}
        <button type="button" aria-label="Next page" className={navButton} onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
          <Icon name="chevronRight" size={16} />
        </button>
        <button type="button" aria-label="Last page" className={navButton} onClick={() => onPageChange(pageCount)} disabled={page >= pageCount}>
          <Icon name="chevronsRight" size={16} />
        </button>
      </div>
      <div className="flex justify-end">
        {pageSizeOptions && onPageSizeChange && (
          <span className="flex items-center gap-2 text-14 text-ink-tertiary">
            Items in page:
            <Popover
              align="right"
              trigger={({ toggle }) => (
                <button
                  type="button"
                  aria-label="Items in page"
                  onClick={toggle}
                  className="font-medium text-ink underline decoration-dashed underline-offset-4"
                >
                  {pageSize}
                </button>
              )}
            >
              {(close) => (
                <div className="w-[96px]">
                  <Menu>
                    {pageSizeOptions.map((n) => (
                      <MenuItem
                        key={n}
                        active={n === pageSize}
                        onClick={() => {
                          onPageSizeChange(n);
                          onPageChange(1);
                          close();
                        }}
                      >
                        {n}
                      </MenuItem>
                    ))}
                  </Menu>
                </div>
              )}
            </Popover>
          </span>
        )}
      </div>
    </div>
  );
}
