"use client";

import { useState } from "react";
import ScanInput, { ResultBanner, postKit, type Banner } from "../ScanInput";
import type { KitBoxSummary } from "@/lib/kit";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export default function PickStation() {
  const [box, setBox] = useState<KitBoxSummary | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);

  async function openBox(code: string) {
    setBusy(true);
    const res = await postKit<{ box?: KitBoxSummary }>({ action: "box", boxCode: code });
    setBusy(false);
    if (!res.ok || !res.box) {
      setBanner({ ok: false, text: res.message ?? "Unknown box label" });
      return;
    }
    setBox(res.box);
    setBanner(
      res.box.status === "open"
        ? null
        : { ok: false, text: `Box ${res.box.code} is already ${res.box.status.replace("_", " ")}` }
    );
  }

  async function scanItem(code: string) {
    if (!box) return;
    setBusy(true);
    const res = await postKit<{ box?: KitBoxSummary; status?: string; shelf?: string | null }>({
      action: "scan",
      boxCode: box.code,
      code,
    });
    setBusy(false);
    if (res.box) setBox(res.box);
    if (!res.ok) {
      setBanner({ ok: false, text: res.message ?? "Scan failed" });
      if (typeof navigator !== "undefined") navigator.vibrate?.(200);
      return;
    }
    if (res.status === "ready") {
      setBanner({
        ok: true,
        text: `READY. ${box.kind === "expo_bag" ? `Shelf: ${res.shelf ?? "-"}` : "Seal the box and send it to staging"}`,
      });
    } else {
      setBanner({ ok: true, text: res.message ?? "Added" });
    }
  }

  function nextBox() {
    setBox(null);
    setBanner(null);
  }

  if (!box) {
    return (
      <div className="space-y-4">
        <ResultBanner banner={banner} />
        <ScanInput label="1. Scan the box / bag label" onScan={openBox} disabled={busy} />
      </div>
    );
  }

  const pct = box.total ? Math.round((box.scanned / box.total) * 100) : 0;
  const isReady = box.status !== "open";
  const shirts = Object.entries(box.missingShirts).sort(
    (a, b) => SIZE_ORDER.indexOf(a[0]) - SIZE_ORDER.indexOf(b[0])
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-xl font-bold">{box.code}</p>
          <p className="text-sm text-neutral-400">
            {box.kind === "expo_bag"
              ? `Expo bag · ${box.runnerName ?? ""}`
              : `${box.kitGroup} · Box ${box.boxNo}`}
          </p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-2xl font-bold">
          {box.scanned} of {box.total}
          {isReady && <span className="ml-3 text-emerald-300">Ready</span>}
        </p>
      </div>

      <ResultBanner banner={banner} />

      {isReady ? (
        <button
          onClick={nextBox}
          className="w-full rounded-lg bg-emerald-500 px-4 py-4 text-lg font-bold text-neutral-950 hover:bg-emerald-400"
        >
          Next box
        </button>
      ) : (
        <>
          <ScanInput label="2. Scan BIB, T-shirt bin (TS-M) or PACK" onScan={scanItem} disabled={busy} />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 p-3 sm:col-span-2">
              <p className="text-sm font-semibold text-neutral-300">BIBs to go ({box.missingBibs.length})</p>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto font-mono text-sm">
                {box.missingBibs.map((b) => (
                  <li key={b.bib} className="flex justify-between gap-3">
                    <span>{b.bib}</span>
                    <span className="truncate text-neutral-400">{b.name}</span>
                  </li>
                ))}
                {box.missingBibs.length === 0 && <li className="text-neutral-500">All BIBs in</li>}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 p-3">
              <p className="text-sm font-semibold text-neutral-300">T-shirts to go</p>
              <ul className="mt-2 space-y-1 font-mono text-sm">
                {shirts.map(([size, n]) => (
                  <li key={size} className="flex justify-between">
                    <span>TS-{size}</span>
                    <span>× {n}</span>
                  </li>
                ))}
                {shirts.length === 0 && <li className="text-neutral-500">All in</li>}
              </ul>
              <p className="mt-3 flex justify-between font-mono text-sm">
                <span>PACK</span>
                <span>× {box.missingPacks}</span>
              </p>
            </div>
          </div>

          <button onClick={nextBox} className="text-sm text-neutral-400 underline hover:text-neutral-200">
            Leave this box and scan another
          </button>
        </>
      )}
    </div>
  );
}
