"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ds";
import CameraScanner from "./CameraScanner";

/** Touch-first device (phone / tablet): focusing the field would pop the keyboard over the screen. */
function isTouchFirst() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * One-line scan field. USB / Bluetooth scanners type the code and press Enter, so this works
 * with a ₹1–2k scanner or by typing; the camera button scans with the phone camera instead.
 * On a laptop it re-focuses itself after every scan so the volunteer never has to click it;
 * on a phone it doesn't (that would keep popping the keyboard up).
 */
export default function ScanInput({
  label,
  onScan,
  disabled,
  placeholder = "Scan or type, then Enter",
  continuous = false,
  feedback = null,
}: {
  label: string;
  onScan: (value: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  /** Camera stays open between scans (several BIBs in a row). */
  continuous?: boolean;
  /** The screen's last result, shown over the camera while it stays open. */
  feedback?: Banner;
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
      {camera && (
        <CameraScanner
          title={label}
          continuous={continuous}
          feedback={feedback}
          onDetect={(v) => submit(v)}
          onClose={() => setCamera(false)}
        />
      )}
    </>
  );
}

export type Banner = { ok: boolean; text: string } | null;

export function ResultBanner({ banner }: { banner: Banner }) {
  if (!banner) return null;
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-12 px-4 py-3 text-16 font-semibold ${
        banner.ok ? "bg-tint-green text-on-tint-green" : "bg-tint-red text-on-tint-red"
      }`}
    >
      <Icon
        name={banner.ok ? "checkCircle" : "xCircle"}
        size={22}
        className={`mt-px shrink-0 ${banner.ok ? "" : "text-[#D92D20]"}`}
      />
      <span className="min-w-0 break-words">{banner.text}</span>
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
