'use client';

import { useSyncExternalStore } from 'react';
import Image from 'next/image';
import { Button } from './Button';
import { Icon } from './Icon';

/*
 * "Install this app" prompt for an installable web app (PWA). Three paths:
 *  - Chrome / Edge / Samsung (desktop and Android): the browser's own install dialog, from a
 *    captured `beforeinstallprompt`, behind one Install button.
 *  - iPhone / iPad (any browser): there is no install API, so it shows the two taps
 *    (Share, then Add to Home Screen).
 *  - Safari on Mac: File → Add to Dock.
 * Nothing shows when the app is already running installed, when the browser can't install
 * (e.g. Firefox desktop), or while the user's "Not now" snooze lasts.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Captured at module load: Chrome fires beforeinstallprompt once per page, often before React
// hydrates, so a listener added in an effect could miss it.
let deferred: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own prompt; the browser's install icon still works
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    justInstalled = true;
    deferred = null;
    emit();
  });
}

type Mode = 'hidden' | 'prompt' | 'ios' | 'mac-safari';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function platformMode(): Mode {
  if (justInstalled || isStandalone()) return 'hidden';
  if (deferred) return 'prompt';
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  const macSafari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/.test(ua);
  if (macSafari) return 'mac-safari';
  return 'hidden';
}

const snoozeKey = (appId: string) => `tgcg.install.${appId}.snoozedUntil`;
const SNOOZE_EVENT = 'tgcg-install-snooze';

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener(SNOOZE_EVENT, cb);
  window.addEventListener('storage', cb);
  const mq = window.matchMedia('(display-mode: standalone)');
  mq.addEventListener('change', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener(SNOOZE_EVENT, cb);
    window.removeEventListener('storage', cb);
    mq.removeEventListener('change', cb);
  };
}

function useInstallMode(appId: string): Mode {
  return useSyncExternalStore(
    subscribe,
    () => {
      const until = Number(window.localStorage.getItem(snoozeKey(appId)) ?? 0);
      if (until > Date.now()) return 'hidden';
      return platformMode();
    },
    () => 'hidden'
  );
}

interface InstallPromptProps {
  /** Storage key for the snooze, e.g. "admin" or "volunteer". */
  appId: string;
  /** Name as it will appear under the icon, e.g. "TGCG Admin". */
  appName: string;
  /** One line on why to install. */
  description: string;
  iconSrc: string;
  /** 'banner': an inline strip at the top of a desktop page. 'sheet': a card pinned to the bottom of a phone screen. */
  variant?: 'banner' | 'sheet';
  /** How long "Not now" hides it (default 7 days). */
  snoozeDays?: number;
  className?: string;
}

export function InstallPrompt({
  appId,
  appName,
  description,
  iconSrc,
  variant = 'banner',
  snoozeDays = 7,
  className = '',
}: InstallPromptProps) {
  const mode = useInstallMode(appId);
  if (mode === 'hidden') return null;

  function snooze() {
    window.localStorage.setItem(snoozeKey(appId), String(Date.now() + snoozeDays * 86_400_000));
    window.dispatchEvent(new Event(SNOOZE_EVENT));
  }

  async function install() {
    const e = deferred;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    // The event can only be used once either way.
    deferred = null;
    if (outcome === 'dismissed') snooze();
    else emit();
  }

  const steps =
    mode === 'ios' ? (
      <ol className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-12 text-ink-secondary">
        <li className="inline-flex items-center gap-1">
          Tap <Icon name="share" size={16} className="text-link" /> <span className="font-medium text-ink">Share,</span>
        </li>
        <li className="inline-flex items-center gap-1">
          then <Icon name="plusSquare" size={16} className="text-ink" />{' '}
          <span className="font-medium text-ink">Add to Home Screen</span>
        </li>
      </ol>
    ) : mode === 'mac-safari' ? (
      <p className="mt-1 text-12 text-ink-secondary">
        In the menu bar choose <span className="font-medium text-ink">File → Add to Dock</span>.
      </p>
    ) : null;

  const icon = <Image src={iconSrc} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-8 border border-line-secondary" />;
  const text = (
    <div className="min-w-0 flex-1">
      <p className="text-14 font-semibold text-ink">Install {appName}</p>
      <p className="text-12 text-ink-tertiary">{description}</p>
      {steps}
    </div>
  );
  const dismiss = (
    <button
      type="button"
      onClick={snooze}
      aria-label="Not now"
      title="Not now"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-6 text-ink-tertiary hover:bg-surface-tertiary hover:text-ink"
    >
      <Icon name="close" size={18} />
    </button>
  );

  if (variant === 'sheet') {
    return (
      <div
        role="region"
        aria-label={`Install ${appName}`}
        className={`fixed inset-x-3 bottom-3 z-40 rounded-12 border border-line-secondary bg-white p-4 shadow-dock-xl pb-[max(1rem,env(safe-area-inset-bottom))] ${className}`}
      >
        <div className="flex items-start gap-3">
          {icon}
          {text}
          {dismiss}
        </div>
        {mode === 'prompt' && (
          <Button variant="dark" onClick={install} className="mt-3 h-12! w-full text-16!">
            <Icon name="download" size={18} />
            Install app
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={`Install ${appName}`}
      className={`flex items-center gap-3 rounded-12 border border-line-secondary bg-surface-secondary px-4 py-3 ${className}`}
    >
      {icon}
      {text}
      {mode === 'prompt' && (
        <Button variant="dark" onClick={install}>
          <Icon name="download" size={16} />
          Install
        </Button>
      )}
      {dismiss}
    </div>
  );
}
