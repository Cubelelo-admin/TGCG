"use client";

import { useState } from "react";
import { Button, Card, Icon } from "@/components/ds";
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
            <Button variant="dark" onClick={next} className="h-14! w-full text-16!">
              Next runner
              <Icon name="arrowRight" size={18} />
            </Button>
          </>
        ) : (
          <>
            <ResultBanner banner={banner} />
            <Card>
              <ScanInput label="1. Scan the runner's QR pass (or type the BIB)" onScan={scanPass} disabled={busy} />
            </Card>
          </>
        )
      ) : (
        <>
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-8 bg-surface-tertiary text-ink">
                <Icon name="user" size={20} />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-32 font-semibold text-ink">{runner.bib ?? "-"}</p>
                <p className="mt-1 text-20 font-medium text-ink">{runner.name}</p>
                <p className="mt-1 text-14 text-ink-tertiary">
                  {runner.category} · T-shirt {runner.tshirt ?? "-"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-8 border border-line px-4 py-3">
                <p className="text-12 font-medium text-ink-secondary">ID last 4:</p>
                <p className="mt-1 font-mono text-28 font-semibold tracking-widest text-ink">
                  {runner.idLast4 ?? "n/a"}
                </p>
              </div>
              {runner.shelfAddress && (
                <div className="rounded-8 bg-tint-blue px-4 py-3 text-on-tint-blue">
                  <p className="flex items-center gap-1.5 text-12 font-medium">
                    <Icon name="package" size={14} />
                    Shelf
                  </p>
                  <p className="mt-1 break-all font-mono text-28 font-semibold">{runner.shelfAddress}</p>
                </div>
              )}
            </div>
          </Card>
          <ResultBanner banner={banner} />
          {canCollect ? (
            <Card>
              <ScanInput label="2. Scan the bag label to confirm" onScan={scanBag} disabled={busy} />
            </Card>
          ) : (
            <Button onClick={next} className="h-12! w-full">
              Next runner
            </Button>
          )}
        </>
      )}
    </div>
  );
}
