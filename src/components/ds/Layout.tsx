'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/* ---------- PageHeader ---------- */

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Renders a back arrow before the title. */
  onBack?: () => void;
}

/** Title 20/26 weight 600 + 14px subtitle on the left, actions on the right. */
export function PageHeader({ title, subtitle, actions, onBack }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {onBack && (
          <button type="button" aria-label="Back" onClick={onBack} className="mt-0.5 text-ink hover:text-ink-tertiary">
            <Icon name="arrowLeft" size={20} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-20 font-semibold text-ink">{title}</h1>
          {subtitle && <div className="mt-1 text-14 text-ink-tertiary">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Banner ---------- */

type BannerTone = 'info' | 'note' | 'danger';

const bannerTones: Record<BannerTone, { box: string; icon: IconName; iconClass: string }> = {
  info: { box: 'bg-[#EFF8FF] border border-tint-blue', icon: 'info', iconClass: 'text-dark' },
  note: { box: 'bg-[#EFF8FF]', icon: 'alert', iconClass: 'text-link' },
  danger: { box: 'bg-tint-red', icon: 'alert', iconClass: 'text-[#D92D20]' },
};

interface BannerProps {
  tone?: BannerTone;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}

/** Info / note / danger message box (e.g. the BIS compliance notice, modal notes). */
export function Banner({ tone = 'info', title, children, action }: BannerProps) {
  const t = bannerTones[tone];
  return (
    <div role="note" className={`flex items-center gap-3 rounded-12 px-4 py-3 ${t.box}`}>
      <Icon name={t.icon} size={20} className={t.iconClass} />
      <div className="min-w-0 flex-1">
        {title && <p className="text-16 text-ink">{title}</p>}
        <div className={title ? 'text-12 text-ink' : 'text-12 text-ink'}>{children}</div>
      </div>
      {action}
    </div>
  );
}

/* ---------- EmptyState ---------- */

export function EmptyState({ title = 'No data', children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Icon name="inbox" size={40} strokeWidth={1.25} className="text-line" />
      <p className="text-14 text-ink-muted">{title}</p>
      {children}
    </div>
  );
}

/* ---------- Breadcrumb ---------- */

export interface Crumb {
  label: string;
  onClick?: () => void;
}

/** `separator` "chevron" (PO details) or "slash" (Knowledge centre), as on the portal. */
export function Breadcrumb({ items, separator = 'chevron' }: { items: Crumb[]; separator?: 'chevron' | 'slash' }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-12">
      {items.map((c, i) => (
        <span key={c.label} className="flex items-center gap-1.5">
          {i > 0 &&
            (separator === 'slash' ? (
              <span aria-hidden="true" className="text-ink-muted">
                /
              </span>
            ) : (
              <Icon name="chevronRight" size={12} className="text-ink-muted" />
            ))}
          {c.onClick ? (
            <button type="button" onClick={c.onClick} className="text-ink-muted underline decoration-dashed underline-offset-2 hover:text-ink">
              {c.label}
            </button>
          ) : (
            <span className="font-medium text-ink">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ---------- Card ---------- */

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-8 bg-white p-5 shadow-card ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-18 font-semibold text-ink">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- Drawer ---------- */

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

/** Right-hand sheet over the 64% overlay (Raise a ticket, Ticket conversations). */
export function Drawer({ open, title, onClose, children, footer, width = 680 }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div data-testid="drawer-overlay" className="fixed inset-0 z-[200] bg-alpha-64" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 flex h-full max-w-full flex-col bg-white shadow-dock-xl"
        style={{ width }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line-secondary px-4">
          <h3 className="text-16 font-semibold text-ink">{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="text-ink-muted hover:text-ink">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line-secondary px-5 py-4">{footer}</div>}
      </aside>
    </div>
  );
}

/* ---------- Stepper ---------- */

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={s} className="relative flex gap-3 pb-20 last:pb-0" aria-current={state === 'current' ? 'step' : undefined}>
            {i < steps.length - 1 && <span className="absolute left-[11px] top-7 h-[calc(100%-32px)] w-px bg-line-secondary" />}
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-12 ${
                state === 'todo' ? 'bg-surface-tertiary text-ink-muted' : 'bg-dark text-white'
              }`}
            >
              {state === 'done' ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span className={`text-14 ${state === 'todo' ? 'text-ink-muted' : 'font-medium text-ink'}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Accordion ---------- */

export interface AccordionItem {
  id: string;
  title: string;
  body: ReactNode;
}

/** FAQ list: one row per question, chevron on the right; the open item can ask for feedback. */
export function Accordion({ items, defaultOpen, feedback = false }: { items: AccordionItem[]; defaultOpen?: string; feedback?: boolean }) {
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null);
  const [votes, setVotes] = useState<Record<string, 'up' | 'down'>>({});
  return (
    <div className="rounded-8 bg-white shadow-card">
      {items.map((it) => {
        const isOpen = open === it.id;
        return (
          <div key={it.id} className="border-b border-line-secondary last:border-b-0">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : it.id)}
              className="flex w-full items-center justify-between gap-4 px-4 py-5 text-left text-14 font-medium text-ink"
            >
              {it.title}
              <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size={16} className="text-ink-tertiary" />
            </button>
            {isOpen && (
              <div className="px-4 pb-5 text-12 leading-[18px] text-ink">
                {it.body}
                {feedback && (
                  <div className="mt-5 flex items-center gap-4 text-12 text-ink-muted">
                    Was this answer helpful?
                    {(['up', 'down'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-label={v === 'up' ? 'Helpful' : 'Not helpful'}
                        aria-pressed={votes[it.id] === v}
                        onClick={() => setVotes((s) => ({ ...s, [it.id]: v }))}
                        className={`flex h-8 w-8 items-center justify-center rounded-8 border ${
                          votes[it.id] === v ? 'border-dark bg-dark text-white' : 'border-ink-muted text-ink-tertiary'
                        }`}
                      >
                        <Icon name={v === 'up' ? 'thumbsUp' : 'thumbsDown'} size={16} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
