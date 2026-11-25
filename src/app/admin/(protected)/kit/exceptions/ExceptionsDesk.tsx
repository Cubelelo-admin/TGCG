"use client";

import { useState } from "react";
import Link from "next/link";
import { ResultBanner, postKit, type Banner } from "../ScanInput";
import type { DeskRunner } from "@/lib/kit";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";
const primaryBtn =
  "rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-neutral-950 hover:bg-emerald-400 disabled:opacity-50";
const ghostBtn = "rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50";

function Chip({ tone, children }: { tone: "ok" | "warn" | "bad" | "plain"; children: React.ReactNode }) {
  const cls = {
    ok: "bg-emerald-500/15 text-emerald-400",
    warn: "bg-amber-500/15 text-amber-400",
    bad: "bg-red-500/15 text-red-400",
    plain: "bg-white/10 text-neutral-300",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export default function ExceptionsDesk({ eventId }: { eventId: string }) {
  const [term, setTerm] = useState("");
  const [runners, setRunners] = useState<DeskRunner[] | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);

  async function search(t = term) {
    if (t.trim().length < 2) return;
    setBusy(true);
    const res = await postKit<{ runners?: DeskRunner[] }>({ action: "desk-search", eventId, term: t });
    setBusy(false);
    if (!res.ok) return setBanner({ ok: false, text: res.message ?? "Search failed" });
    setRunners(res.runners ?? []);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBanner(null);
          void search();
        }}
        className="flex gap-2"
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoFocus
          placeholder="Name, mobile, BIB, pass code, POC..."
          className={inputClass}
        />
        <button className={primaryBtn} disabled={busy || term.trim().length < 2}>
          Search
        </button>
      </form>

      <ResultBanner banner={banner} />

      {runners?.length === 0 && <p className="text-sm text-neutral-400">No runner found.</p>}

      {runners?.map((r) => (
        <RunnerCard
          key={r.registrationId}
          runner={r}
          eventId={eventId}
          onDone={(b) => {
            setBanner(b);
            void search();
          }}
        />
      ))}
    </div>
  );
}

function RunnerCard({
  runner: r,
  eventId,
  onDone,
}: {
  runner: DeskRunner;
  eventId: string;
  onDone: (b: Banner) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [collectReason, setCollectReason] = useState("");

  const paid = r.paymentStatus === "paid";
  const corporate = r.channel === "corporate";
  const collected = r.bagStatus === "collected";

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    const res = await postKit<{ bags?: number; groupBoxes?: number }>(body);
    setBusy(false);
    onDone({
      ok: res.ok,
      text: res.ok
        ? (res.message ?? `Done: ${r.name}`)
        : (res.message ?? "Failed"),
    });
  }

  return (
    <div className="rounded-xl border border-white/10 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xl font-bold">
          {r.name} <span className="font-mono text-base text-neutral-400">{r.bib ?? ""}</span>
        </p>
        <p className="font-mono text-sm text-neutral-400">{r.registrationCode ?? "no pass yet"}</p>
      </div>
      <p className="mt-1 text-sm text-neutral-400">
        {r.category} · T-shirt {r.tshirt ?? "-"} · {r.phone ?? "no phone"}
        {r.idLast4 ? ` · ID last 4: ${r.idLast4}` : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip tone={paid ? "ok" : "bad"}>{paid ? "Paid" : r.paymentStatus}</Chip>
        <Chip tone={corporate ? "warn" : "plain"}>{corporate ? `Corporate: ${r.kitGroup}` : "Expo"}</Chip>
        {r.bagCode ? (
          <Chip tone={collected ? "ok" : r.bagStatus === "ready" ? "ok" : "warn"}>
            Bag {r.bagCode}: {r.bagStatus?.replace("_", " ")}
            {r.bagStatus === "open" && r.boxTotal ? ` (${r.boxScanned}/${r.boxTotal})` : ""}
          </Chip>
        ) : paid && !corporate ? (
          <Chip tone="bad">No bag packed</Chip>
        ) : null}
        {r.shelfAddress && <Chip tone="plain">{r.shelfAddress}</Chip>}
      </div>

      <div className="mt-4 space-y-4">
        {!paid && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-400">
            Not paid. Collect payment and mark it paid in Registrations, then come back to create the bag.{" "}
            <Link
              href={{ pathname: "/admin/registrations", query: { q: r.name, field: "name" } }}
              className="font-semibold underline"
            >
              Open in Registrations
            </Link>
          </div>
        )}

        {paid && corporate && (
          <p className="text-sm text-neutral-400">
            Corporate runner: the kit goes in a group box to the company rep on day 0, not through this desk.
          </p>
        )}

        {paid && !corporate && !r.bagCode && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-neutral-400">Late sign-up or paid after boxes were generated.</p>
            <button disabled={busy} onClick={() => run({ action: "generate", eventId })} className={primaryBtn}>
              Create bag
            </button>
          </div>
        )}

        {paid && !corporate && r.bagCode && r.bagStatus === "open" && (
          <Link href={{ pathname: "/admin/kit/pick", query: { box: r.bagCode } }} className={`${primaryBtn} inline-block`}>
            Pack it now
          </Link>
        )}

        {paid && r.tshirt && !collected && (
          <div>
            <p className="text-sm font-semibold text-neutral-300">Swap T-shirt size (currently {r.tshirt})</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select value={size} onChange={(e) => setSize(e.target.value)} className={`${inputClass} !w-28`}>
                <option value="" className="bg-neutral-900">
                  New size
                </option>
                {SIZES.filter((s) => s !== r.tshirt).map((s) => (
                  <option key={s} value={s} className="bg-neutral-900">
                    {s}
                  </option>
                ))}
              </select>
              <input
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                placeholder="Reason (optional)"
                className={`${inputClass} !w-64`}
              />
              <button
                disabled={busy || !size}
                onClick={() => run({ action: "swap-size", registrationId: r.registrationId, size, reason: swapReason })}
                className={ghostBtn}
              >
                Swap size
              </button>
            </div>
          </div>
        )}

        {paid && !corporate && !collected && (
          <div>
            <p className="text-sm font-semibold text-neutral-300">Hand over at the desk (no bag scan)</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={collectReason}
                onChange={(e) => setCollectReason(e.target.value)}
                placeholder="Reason, e.g. bag label damaged"
                className={`${inputClass} !w-72`}
              />
              <button
                disabled={busy || collectReason.trim().length < 3}
                onClick={() => {
                  if (!confirm(`Mark ${r.name}'s kit as collected without scanning the bag?`)) return;
                  void run({ action: "desk-collect", registrationId: r.registrationId, reason: collectReason });
                }}
                className={ghostBtn}
              >
                Mark collected
              </button>
            </div>
          </div>
        )}

        {collected && <p className="text-sm text-emerald-400">Kit already collected.</p>}
      </div>
    </div>
  );
}
