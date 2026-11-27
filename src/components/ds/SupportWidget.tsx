'use client';

import { useState } from 'react';
import { Icon } from './Icon';

interface SupportWidgetProps {
  userFirstName: string;
  faqs: string[];
  onOpenFaq?: (question: string) => void;
  onViewAll?: () => void;
  onRaiseTicket?: () => void;
  onMyTickets?: () => void;
}

/** 54px dark floating button (bottom-right) that opens the help panel; the panel header carries the brand accent. */
export function SupportWidget({ userFirstName, faqs, onOpenFaq, onViewAll, onRaiseTicket, onMyTickets }: SupportWidgetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = query ? faqs.filter((f) => f.toLowerCase().includes(query.toLowerCase())) : faqs;
  const run = (fn?: () => void) => () => {
    setOpen(false);
    fn?.();
  };

  return (
    <div className="fixed bottom-4 right-10 z-[150] flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label="Help"
          className="flex h-[571px] w-[330px] flex-col overflow-hidden rounded-16 border border-line-secondary bg-surface-secondary shadow-dock-xl"
        >
          <div className="px-4 pb-6 pt-10" style={{ background: 'linear-gradient(135deg, var(--accent-strong) 0%, var(--accent) 100%)' }}>
            <p className="text-24 font-semibold text-white">
              Hello {userFirstName}.
              <br />
              How can we help?
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-surface-secondary px-3 pt-1">
            <div className="flex h-9 items-center gap-2 rounded-12 bg-white px-3 shadow-[0_-4px_12px_rgba(23,23,28,.08)]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for help topics, issues..."
                className="min-w-0 flex-1 text-14 outline-hidden placeholder:text-ink-muted"
              />
              <Icon name="search" size={16} className="text-ink-tertiary" />
            </div>
            <div className="rounded-12 bg-white px-3 py-2 shadow-[2px_9px_12px_rgba(23,23,28,.08)]">
              <p className="mb-2 text-12 font-medium text-ink">Frequently Asked Questions</p>
              <ul className="max-h-[150px] overflow-y-auto">
                {shown.map((f) => (
                  <li key={f}>
                    <button type="button" onClick={() => onOpenFaq?.(f)} className="flex w-full items-start gap-2 py-2 text-left text-12 font-medium text-ink">
                      <span className="flex-1">{f}</span>
                      <Icon name="chevronRight" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={run(onViewAll)} className="mx-auto my-1 block text-12 font-medium text-ink underline decoration-dotted underline-offset-4">
                View all →
              </button>
            </div>
            <button
              type="button"
              onClick={run(onRaiseTicket)}
              className="flex items-center gap-3 rounded-12 bg-white px-5 py-3 text-left shadow-[-4px_8px_16px_rgba(23,23,28,.08)]"
            >
              <span className="flex-1">
                <span className="block text-14 font-medium text-ink">Raise a ticket</span>
                <span className="block text-12 text-ink-tertiary">Contact our team for help</span>
              </span>
              <Icon name="send" size={18} className="text-accent-strong" />
            </button>
          </div>
          <div className="grid grid-cols-2 rounded-b-16 bg-white py-2 shadow-[0_-2px_8px_rgba(0,0,0,.04)]">
            <span className="flex flex-col items-center gap-0.5 text-12 font-medium text-accent-strong">
              <Icon name="question" size={18} />
              Help
            </span>
            <button type="button" onClick={run(onMyTickets)} className="flex flex-col items-center gap-0.5 text-12 text-ink-muted hover:text-ink">
              <Icon name="ticket" size={18} />
              My Tickets
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label={open ? 'Close help' : 'Help and support'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-ink text-white shadow-[0_8.7px_8.7px_rgba(0,0,0,.08)]"
      >
        <Icon name={open ? 'close' : 'help'} size={24} />
      </button>
    </div>
  );
}
