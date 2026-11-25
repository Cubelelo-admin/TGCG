"use client";

import { useEffect, useRef, useState } from "react";

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
      <label className="block text-sm text-neutral-400">{label}</label>
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-white/20 bg-white/[0.04] px-4 py-3 font-mono text-lg tracking-wide focus:border-emerald-400 focus:outline-none disabled:opacity-50"
      />
    </form>
  );
}

export type Banner = { ok: boolean; text: string } | null;

export function ResultBanner({ banner }: { banner: Banner }) {
  if (!banner) return null;
  return (
    <div
      role="status"
      className={`rounded-lg border px-4 py-3 text-base font-semibold ${
        banner.ok
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
          : "border-red-400/50 bg-red-500/15 text-red-300"
      }`}
    >
      {banner.text}
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
