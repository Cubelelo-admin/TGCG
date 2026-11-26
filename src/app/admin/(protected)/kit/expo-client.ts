"use client";

import { useEffect, useRef } from "react";
import type { ExpoKind } from "@/lib/expo";

export const KIND_LABEL: Record<ExpoKind, string> = { bib: "BIB", tshirt: "T-shirt", pack: "Pack" };

/** POST to the expo API. Never throws: network / auth problems come back as {ok:false, message}. */
export async function postExpo<T = Record<string, unknown>>(
  body: Record<string, unknown>
): Promise<T & { ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/admin/kit/expo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) return { ok: false, message: "Signed out: reload and sign in again" } as never;
    if (res.status === 403) return { ok: false, message: "Your role can't do that" } as never;
    if (!res.ok) return { ok: false, message: json.error ?? json.message ?? "Server error: try again" } as never;
    return json;
  } catch {
    return { ok: false, message: "No connection: try again" } as never;
  }
}

/**
 * Calls `fn` now and every `ms` while the tab is visible, never overlapping itself
 * (a slow venue network must not stack requests). Pauses in a background tab.
 */
export function usePoll(fn: () => Promise<void>, ms: number, enabled = true) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") await fnRef.current().catch(() => undefined);
      if (!stopped) timer = setTimeout(tick, ms);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void tick();
      }
    };
    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}

/**
 * Drops replies that arrive out of order. A poll that left before an action (Accept, scan) can
 * come back after the action's own refresh and paint the old state over the new one (seen in
 * the dry run: the offer card reappeared after Accept). Call begin() when a request leaves and
 * isStale(ticket) when it comes back: true = a newer reply was already shown, ignore this one.
 * drop() makes every reply still in flight stale (the desk switched station, say).
 */
export function useLatestReply() {
  const sent = useRef(0);
  const shown = useRef(0);
  return {
    begin: () => ++sent.current,
    isStale: (ticket: number) => {
      if (ticket < shown.current) return true;
      shown.current = ticket;
      return false;
    },
    drop: () => {
      shown.current = ++sent.current;
    },
  };
}

/** Short two-tone chime (no audio file). Browsers only allow it after the user has tapped the page once. */
export function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.17);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // Sound is a nice-to-have.
  }
}

export function buzz(ms = 200) {
  if (typeof navigator !== "undefined") navigator.vibrate?.(ms);
}

/** "3:07" since an ISO time. */
export function elapsed(fromIso: string, now: number) {
  const s = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
