"use client";

import { useState } from "react";
import ScanInput, { ResultBanner, postKit, type Banner } from "../ScanInput";
import type { KitRunnerLookup } from "@/lib/kit";

export default function CounterStation({ eventId }: { eventId: string }) {
  const [runner, setRunner] = useState<KitRunnerLookup | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function scanPass(code: string) {
    setBusy(true);
    const res = await postKit<{ runner?: KitRunnerLookup }>({ action: "lookup", eventId, code });
    setBusy(false);
    if (!res.ok || !res.runner) {
      setRunner(null);
      return setBanner({ ok: false, text: res.message ?? "Not found" });
    }
    setDone(false);
    setRunner(res.runner);
    const r = res.runner;
    if (r.channel === "corporate") {
      setBanner({ ok: false, text: `Corporate runner (${r.kitGroup}): kit goes via the company rep, not the expo` });
    } else if (!r.bagCode) {
      setBanner({ ok: false, text: "No bag packed for this runner: send to the exceptions desk" });
    } else if (r.bagStatus === "collected") {
      setBanner({ ok: false, text: "Kit already collected" });
    } else if (r.bagStatus !== "ready") {
      setBanner({ ok: false, text: "Bag is not complete yet: send to the exceptions desk" });
    } else {
      setBanner(null);
    }
  }

  async function scanBag(code: string) {
    if (!runner) return;
    setBusy(true);
    const res = await postKit({ action: "collect", bagCode: code, registrationId: runner.registrationId });
    setBusy(false);
    if (!res.ok) {
      navigator.vibrate?.(200);
      return setBanner({ ok: false, text: res.message ?? "Could not collect" });
    }
    setDone(true);
    setBanner({ ok: true, text: `Collected: ${runner.name}` });
  }

  function next() {
    setRunner(null);
    setDone(false);
    setBanner(null);
  }

  const canCollect = runner && runner.channel === "expo" && runner.bagStatus === "ready" && !done;

  return (
    <div className="space-y-4">
      {!runner || done ? (
        done ? (
          <>
            <ResultBanner banner={banner} />
            <button
              onClick={next}
              className="w-full rounded-lg bg-emerald-500 px-4 py-4 text-lg font-bold text-neutral-950 hover:bg-emerald-400"
            >
              Next runner
            </button>
          </>
        ) : (
          <>
            <ResultBanner banner={banner} />
            <ScanInput label="1. Scan the runner's QR pass (or type the BIB)" onScan={scanPass} disabled={busy} />
          </>
        )
      ) : (
        <>
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-3xl font-bold">{runner.bib ?? "-"}</p>
            <p className="mt-1 text-xl">{runner.name}</p>
            <p className="mt-1 text-sm text-neutral-400">
              {runner.category} · T-shirt {runner.tshirt ?? "-"}
            </p>
            <p className="mt-3 text-lg">
              ID last 4: <span className="font-mono font-bold">{runner.idLast4 ?? "n/a"}</span>
            </p>
            {runner.shelfAddress && (
              <p className="mt-2 inline-block rounded bg-emerald-500/10 px-2 py-1 font-mono text-sm text-emerald-300">
                {runner.shelfAddress}
              </p>
            )}
          </div>
          <ResultBanner banner={banner} />
          {canCollect ? (
            <ScanInput label="2. Scan the bag label to confirm" onScan={scanBag} disabled={busy} />
          ) : (
            <button
              onClick={next}
              className="w-full rounded-lg border border-white/20 px-4 py-3 font-semibold hover:bg-white/10"
            >
              Next runner
            </button>
          )}
        </>
      )}
    </div>
  );
}
