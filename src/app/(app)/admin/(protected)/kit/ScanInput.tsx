"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ds";
import CameraScanner from "./CameraScanner";

/** Touch-first device (phone / tablet): focusing a field would pop the keyboard over the screen. */
export function isTouchFirst() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * One-line scan field. USB / Bluetooth scanners type the code and press Enter, so this works
 * with a ₹1–2k scanner or by typing; the camera button scans one code with the phone camera.
 * On a laptop it re-focuses itself after every scan so the volunteer never has to click it;
 * on a phone it doesn't (that would keep popping the keyboard up).
 */
export default function ScanInput({
  label,
  onScan,
  disabled,
  placeholder = "Scan or type, then Enter",
}: {
  label: string;
  onScan: (value: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [camera, setCamera] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!disabled && !isTouchFirst()) ref.current?.focus();
  }, [disabled]);

  async function submit(raw: string) {
    const v = raw.trim();
    if (!v) return;
    setValue("");
    await onScan(v);
    if (!isTouchFirst()) ref.current?.focus();
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(value);
        }}
      >
        <label htmlFor={id} className="block text-14 font-medium text-ink-secondary">
          {label}
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Icon
              name="scan"
              size={22}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id={id}
              ref={ref}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={disabled}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="go"
              placeholder={placeholder}
              className="h-12 w-full rounded-6 border border-line bg-white pl-12 pr-4 font-mono text-20 tracking-wide text-ink outline-hidden placeholder:font-sans placeholder:text-16 placeholder:tracking-normal placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-ink-muted"
            />
          </div>
          <button
            type="button"
            onClick={() => setCamera(true)}
            disabled={disabled}
            aria-label={`${label}: scan with camera`}
            title="Scan with camera"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-6 border border-dark bg-dark text-white hover:bg-ink disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-tertiary disabled:text-ink-disabled"
          >
            <Icon name="qr" size={22} />
          </button>
        </div>
      </form>
      {camera && <CameraScanner title={label} onDetect={(v) => submit(v)} onClose={() => setCamera(false)} />}
    </>
  );
}

/** The older result shape: the counter, pick & pack, handover, restock, floor and exceptions screens still use it. */
export type Banner = { ok: boolean; text: string } | null;

export type AlertTone = "error" | "warn" | "note" | "done";
/** An alert on a volunteer screen: what happened (title), then at most one line on what to do now. */
export type Alert = { tone: AlertTone; title: string; text?: string };

/**
 * An API message as an alert. Messages put what happened before ": " and what to do after it, so
 * "No items assigned yet: ask the supervisor" becomes that title with "Ask the supervisor" under
 * it. ok gives green, otherwise red: callers change the tone where the spec says amber or blue.
 */
export function alertFrom(ok: boolean, message: string): Alert {
  const tone: AlertTone = ok ? "done" : "error";
  const at = message.indexOf(": ");
  if (at < 0) return { tone, title: message };
  const rest = message.slice(at + 2);
  return { tone, title: message.slice(0, at), text: rest.charAt(0).toUpperCase() + rest.slice(1) };
}

const TONES: Record<AlertTone, { box: string; icon: IconName; iconColor: string; title: string; role: "alert" | "status" }> = {
  error: {
    box: "border border-[#FDA29B] border-l-[5px] border-l-[#D92D20] bg-tint-red text-on-tint-red",
    icon: "xCircle",
    iconColor: "text-[#D92D20]",
    title: "text-18",
    role: "alert",
  },
  warn: {
    box: "border border-[#FEDF89] border-l-[5px] border-l-[#F79009] bg-[#FFFAEB] text-[#93370D]",
    icon: "alert",
    iconColor: "text-[#DC6803]",
    title: "text-16",
    role: "alert",
  },
  note: {
    box: "border-l-[5px] border-l-[#1570EF] bg-[#EFF8FF] text-on-tint-blue",
    icon: "info",
    iconColor: "text-[#1570EF]",
    title: "text-16",
    role: "status",
  },
  done: {
    box: "border-l-[5px] border-l-[#079455] bg-tint-green text-on-tint-green",
    icon: "checkCircle",
    iconColor: "text-[#079455]",
    title: "text-16",
    role: "status",
  },
};

/**
 * The one alert on every volunteer screen (docs/volunteer-assignments-design.md §4.3): an icon, a
 * bold title, at most one line under it. Red = a wrong scan (larger title), amber = a warning,
 * blue = a note, green = done. A green Alert hides itself after 3 s; red and amber stay until the
 * screen replaces them. onDismiss adds a × (assignment notes). The older {ok, text} shape still
 * works: green or red, title only, and it never hides itself (pick & pack's "READY. Shelf …"
 * must stay on screen).
 */
export function ResultBanner({
  banner,
  onDismiss,
  className = "",
}: {
  banner: Banner | Alert;
  onDismiss?: () => void;
  className?: string;
}) {
  // Keyed on the object: the same words shown again later are a new alert.
  const [hidden, setHidden] = useState<Alert | null>(null);
  const fading = banner && "tone" in banner && banner.tone === "done" ? banner : null;
  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(() => setHidden(fading), 3000);
    return () => clearTimeout(timer);
  }, [fading]);
  if (!banner || banner === hidden) return null;

  const alert: Alert = "tone" in banner ? banner : { tone: banner.ok ? "done" : "error", title: banner.text };
  const t = TONES[alert.tone];
  return (
    <div role={t.role} className={`flex items-start gap-3 rounded-12 px-3 py-3 ${t.box} ${className}`}>
      <Icon name={t.icon} size={22} className={`mt-px shrink-0 ${t.iconColor}`} />
      <div className="min-w-0 flex-1 break-words">
        <p className={`font-bold ${t.title}`}>{alert.title}</p>
        {alert.text && <p className="mt-0.5 text-14 text-ink">{alert.text}</p>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-mr-1 shrink-0 px-1 text-20 leading-none">
          ×
        </button>
      )}
    </div>
  );
}

export async function postKit<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/admin/kit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) return { ok: false, message: "Signed out: reload and sign in again" } as never;
    if (res.status === 403) return { ok: false, message: "Your role can't do that" } as never;
    if (!res.ok && json.error) return { ok: false, message: json.error } as never;
    return json;
  } catch {
    return { ok: false, message: "No connection: try again" } as never;
  }
}
