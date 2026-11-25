'use client';

import { useEffect, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Small line under the title (e.g. "Update MRPs for new variant creation using a file upload."). */
  subtitle?: string;
  /** Icon tile before the title, used by the upload/compliance dialogs. */
  icon?: IconName;
  width?: number;
  /** Hide the ✕ (dialogs that must be answered, like the feature announcement). */
  hideClose?: boolean;
}

export function Modal({ open, title, onClose, children, footer, subtitle, icon, width = 480, hideClose = false }: ModalProps) {
  useEffect(() => {
    if (!open || hideClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hideClose, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="modal-overlay"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-alpha-64 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !hideClose) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] max-w-[92vw] flex-col rounded-12 border border-line-secondary bg-white shadow-dock-xl"
        style={{ width }}
      >
        <div className={`flex items-start justify-between gap-3 p-5 ${icon ? 'border-b border-line-secondary pb-4' : 'pb-4'}`}>
          <div className="flex items-start gap-3">
            {icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-8 border border-line-secondary text-ink">
                <Icon name={icon} size={18} />
              </span>
            )}
            <div>
              <h3 className={icon ? 'text-16 font-semibold text-ink' : 'text-24 font-semibold text-ink'}>{title}</h3>
              {subtitle && <p className="mt-0.5 text-14 text-ink-tertiary">{subtitle}</p>}
            </div>
          </div>
          {!hideClose && (
            <button type="button" aria-label="Close" className="text-ink-muted hover:text-ink" onClick={onClose}>
              <Icon name="close" size={20} />
            </button>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line-secondary px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
