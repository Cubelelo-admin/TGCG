"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ds";

/**
 * One-line scan field. USB / Bluetooth scanners type the code and press Enter,
 * so this works with a ₹1–2k scanner or by typing. Re-focuses itself after
 * every scan so the volunteer never has to tap it.
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
  const id = useId();

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        setValue("");
        await onScan(v);
        ref.current?.focus();
      }}
    >
      <label htmlFor={id} className="block text-14 font-medium text-ink-secondary">
        {label}
      </label>
      <div className="relative mt-1.5">
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
          placeholder={placeholder}
          className="h-12 w-full rounded-6 border border-line bg-white pl-12 pr-4 font-mono text-20 tracking-wide text-ink outline-hidden placeholder:font-sans placeholder:text-16 placeholder:tracking-normal placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-ink-muted"
        />
      </div>
    </form>
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
    if (!res.ok && json.error) return { ok: false, message: json.error } as never;
    return json;
  } catch {
    return { ok: false, message: "No connection: try again" } as never;
  }
}
