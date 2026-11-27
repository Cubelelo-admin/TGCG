"use client";

import { useEffect, useState } from "react";
import { Button, Card, DataTable, Icon, StatusPill, type ColumnDef } from "@/components/ds";
import ScanInput, { ResultBanner, postKit, type Banner } from "../ScanInput";
import type { KitBoxSummary } from "@/lib/kit";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

type MissingBib = KitBoxSummary["missingBibs"][number];

const bibColumns: ColumnDef<MissingBib>[] = [
  {
    key: "bib",
    header: "BIB",
    width: 96,
    render: (b) => <span className="font-mono text-14 font-medium">{b.bib}</span>,
  },
  {
    key: "name",
    header: "Runner",
    render: (b) => <span className="block truncate text-ink-tertiary">{b.name}</span>,
  },
];

export default function PickStation({ initialBox }: { initialBox?: string }) {
  const [box, setBox] = useState<KitBoxSummary | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Deep link from the exceptions desk (?box=KB-000123): open that bag straight away.
    if (initialBox) void openBox(initialBox);
  }, [initialBox]);

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
        <Card>
          <ScanInput label="1. Scan the box / bag label" onScan={openBox} disabled={busy} />
        </Card>
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
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-8 bg-surface-tertiary text-ink">
              <Icon name={box.kind === "expo_bag" ? "package" : "box"} size={20} />
            </span>
            <div className="min-w-0">
              <p className="break-all font-mono text-20 font-semibold text-ink">{box.code}</p>
              <p className="text-14 text-ink-tertiary">
                {box.kind === "expo_bag"
                  ? `Expo bag · ${box.runnerName ?? ""}`
                  : `${box.kitGroup} · Box ${box.boxNo}`}
              </p>
            </div>
          </div>
          {isReady && <StatusPill tone="active">Ready</StatusPill>}
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-3">
          <p className="text-32 font-semibold text-ink">
            {box.scanned} of {box.total}
          </p>
          <p className="text-14 text-ink-muted">{pct}%</p>
        </div>
        <div
          className="mt-2 h-3 overflow-hidden rounded-full bg-surface-tertiary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={box.total}
          aria-valuenow={box.scanned}
          aria-label="Items scanned"
        >
          <div
            className={`h-full rounded-full transition-all ${isReady ? "bg-[#079455]" : "bg-dark"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </Card>

      <ResultBanner banner={banner} />

      {isReady ? (
        <Button variant="dark" onClick={nextBox} className="h-14! w-full text-16!">
          Next box
          <Icon name="arrowRight" size={18} />
        </Button>
      ) : (
        <>
          <Card>
            <ScanInput label="2. Scan BIB, T-shirt bin (TS-M) or PACK" onScan={scanItem} disabled={busy} />
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card title={`BIBs to go (${box.missingBibs.length})`} className="min-w-0 sm:col-span-2">
              {box.missingBibs.length === 0 ? (
                <p className="flex items-center gap-2 text-14 text-ink-muted">
                  <Icon name="checkCircle" size={16} />
                  All BIBs in
                </p>
              ) : (
                <DataTable
                  columns={bibColumns}
                  rows={box.missingBibs}
                  rowKey={(b) => b.bib}
                  maxHeight={224}
                  minWidth={0}
                />
              )}
            </Card>
            <Card title="T-shirts to go" className="min-w-0">
              {shirts.length === 0 ? (
                <p className="flex items-center gap-2 text-14 text-ink-muted">
                  <Icon name="checkCircle" size={16} />
                  All in
                </p>
              ) : (
                <ul className="divide-y divide-line-secondary rounded-8 border border-line">
                  {shirts.map(([size, n]) => (
                    <li key={size} className="flex items-center justify-between px-3 py-2.5 font-mono text-14 text-ink">
                      <span>TS-{size}</span>
                      <span className="font-semibold">× {n}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-center justify-between rounded-8 bg-surface-tertiary px-3 py-2.5 font-mono text-14 text-ink">
                <span>PACK</span>
                <span className="font-semibold">× {box.missingPacks}</span>
              </div>
            </Card>
          </div>

          <Button onClick={nextBox} className="h-12! w-full">
            Leave this box and scan another
          </Button>
        </>
      )}
    </div>
  );
}
