"use client";

import { useState } from "react";
import Link from "next/link";
import { ResultBanner, postKit, type Banner as ResultBannerState } from "../ScanInput";
import type { DeskRunner } from "@/lib/kit";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  FieldLabel,
  Icon,
  Modal,
  SearchInput,
  StatusPill,
  TextField,
  buttonClass,
  inputClass,
  type StatusTone,
} from "@/components/ds";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export default function ExceptionsDesk({ eventId }: { eventId: string }) {
  const [term, setTerm] = useState("");
  const [runners, setRunners] = useState<DeskRunner[] | null>(null);
  const [banner, setBanner] = useState<ResultBannerState>(null);
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
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBanner(null);
            void search();
          }}
          className="flex flex-wrap gap-2"
        >
          <SearchInput
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoFocus
            placeholder="Name, mobile, BIB, pass code, POC..."
            aria-label="Search runners"
            className="min-w-[220px] flex-1"
          />
          <Button variant="dark" disabled={busy || term.trim().length < 2}>
            <Icon name="search" size={16} />
            Search
          </Button>
        </form>
      </Card>

      <ResultBanner banner={banner} />

      {runners?.length === 0 && (
        <Card>
          <EmptyState title="No runner found." />
        </Card>
      )}

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
  onDone: (b: ResultBannerState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [collectReason, setCollectReason] = useState("");
  const [dialog, setDialogState] = useState<"swap" | "collect" | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  function setDialog(d: "swap" | "collect" | null) {
    setDialogError(null);
    setDialogState(d);
  }

  const paid = r.paymentStatus === "paid";
  const corporate = r.channel === "corporate";
  const collected = r.bagStatus === "collected";

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    const res = await postKit<{ bags?: number; groupBoxes?: number }>(body);
    setBusy(false);
    // Keep the dialog open on failure so staff can correct the size/reason and retry.
    if (res.ok) setDialog(null);
    else setDialogError(res.message ?? "Failed");
    onDone({
      ok: res.ok,
      text: res.ok
        ? (res.message ?? `Done: ${r.name}`)
        : (res.message ?? "Failed"),
    });
  }

  const bagTone: StatusTone = collected || r.bagStatus === "ready" ? "active" : "warning";
  const canSwap = paid && !!r.tshirt && !collected;
  const canCollect = paid && !corporate && !collected;
  const canCreateBag = paid && !corporate && !r.bagCode;
  const canPack = paid && !corporate && !!r.bagCode && r.bagStatus === "open";
  const fieldId = `desk-${r.registrationId}`;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-baseline gap-2 text-18 font-semibold text-ink">
            {r.name}
            <span className="font-mono text-14 font-normal text-ink-muted">{r.bib ?? ""}</span>
          </h2>
          <p className="mt-1 text-14 text-ink-tertiary">
            {r.category} · T-shirt {r.tshirt ?? "-"} · {r.phone ?? "no phone"}
            {r.idLast4 ? ` · ID last 4: ${r.idLast4}` : ""}
          </p>
        </div>
        <p className="font-mono text-14 text-ink-muted">{r.registrationCode ?? "no pass yet"}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone={paid ? "active" : "expired"}>{paid ? "Paid" : r.paymentStatus}</StatusPill>
        <StatusPill tone={corporate ? "warning" : "pending"}>{corporate ? `Corporate: ${r.kitGroup}` : "Expo"}</StatusPill>
        {r.bagCode ? (
          <StatusPill tone={bagTone}>
            Bag {r.bagCode}: {r.bagStatus?.replace("_", " ")}
            {r.bagStatus === "open" && r.boxTotal ? ` (${r.boxScanned}/${r.boxTotal})` : ""}
          </StatusPill>
        ) : paid && !corporate ? (
          <StatusPill tone="expired">No bag packed</StatusPill>
        ) : null}
        {r.shelfAddress && <StatusPill tone="pending">{r.shelfAddress}</StatusPill>}
      </div>

      <div className="mt-4 space-y-3">
        {!paid && (
          <Banner tone="danger">
            <span className="text-14">
              Not paid. Collect payment and mark it paid in Registrations, then come back to create the bag.
            </span>
            <div className="mt-2">
              <Link
                href={{ pathname: "/admin/registrations", query: { q: r.name, field: "name" } }}
                className={buttonClass({ variant: "outline", size: "sm" })}
              >
                Open in Registrations
              </Link>
            </div>
          </Banner>
        )}

        {paid && corporate && (
          <p className="text-14 text-ink-tertiary">
            Corporate runner: the kit goes in a group box to the company rep on day 0, not through this desk.
          </p>
        )}

        {canCreateBag && (
          <p className="text-14 text-ink-tertiary">Late sign-up or paid after boxes were generated.</p>
        )}

        {collected && (
          <p className="flex items-center gap-1.5 text-14 font-medium text-on-tint-green">
            <Icon name="checkCircle" size={16} />
            Kit already collected.
          </p>
        )}
      </div>

      {(canCreateBag || canPack || canSwap || canCollect) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-secondary pt-4">
          {canCreateBag && (
            <Button variant="dark" disabled={busy} onClick={() => run({ action: "generate", eventId })}>
              <Icon name="package" size={16} />
              Create bag
            </Button>
          )}

          {canPack && (
            <Link
              href={{ pathname: "/admin/kit/pick", query: { box: r.bagCode } }}
              className={buttonClass({ variant: "dark" })}
            >
              <Icon name="scan" size={16} />
              Pack it now
            </Link>
          )}

          {canSwap && (
            <Button disabled={busy} onClick={() => setDialog("swap")}>
              <Icon name="shirt" size={16} />
              Swap size
            </Button>
          )}

          {canCollect && (
            <Button disabled={busy} onClick={() => setDialog("collect")}>
              <Icon name="handover" size={16} />
              Mark collected
            </Button>
          )}
        </div>
      )}

      {canSwap && (
        <Modal
          open={dialog === "swap"}
          title="Swap T-shirt size"
          subtitle={`${r.name} · currently ${r.tshirt}`}
          icon="shirt"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button size="sm" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="dark"
                disabled={busy || !size}
                onClick={() => run({ action: "swap-size", registrationId: r.registrationId, size, reason: swapReason })}
              >
                Swap size
              </Button>
            </>
          }
        >
          <div className="space-y-4 pt-4">
            {dialogError && <Banner tone="danger">{dialogError}</Banner>}
            <div>
              <FieldLabel label="New size" required htmlFor={`${fieldId}-size`} />
              <select
                id={`${fieldId}-size`}
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className={inputClass}
              >
                <option value="">New size</option>
                {SIZES.filter((s) => s !== r.tshirt).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              id={`${fieldId}-swap-reason`}
              label="Reason"
              value={swapReason}
              onChange={(e) => setSwapReason(e.target.value)}
              placeholder="Reason (optional)"
            />
          </div>
        </Modal>
      )}

      {canCollect && (
        <Modal
          open={dialog === "collect"}
          title="Hand over at the desk"
          subtitle="No bag scan"
          icon="handover"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button size="sm" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="dark"
                disabled={busy || collectReason.trim().length < 3}
                onClick={() => {
                  if (!confirm(`Mark ${r.name}'s kit as collected without scanning the bag?`)) return;
                  void run({ action: "desk-collect", registrationId: r.registrationId, reason: collectReason });
                }}
              >
                Mark collected
              </Button>
            </>
          }
        >
          <div className="space-y-3 pt-4">
            {dialogError && <Banner tone="danger">{dialogError}</Banner>}
            <p className="text-14 text-ink-tertiary">
              Mark {r.name}&apos;s kit as collected without scanning the bag.
            </p>
            <TextField
              id={`${fieldId}-collect-reason`}
              label="Reason"
              required
              value={collectReason}
              onChange={(e) => setCollectReason(e.target.value)}
              placeholder="Reason, e.g. bag label damaged"
            />
          </div>
        </Modal>
      )}
    </Card>
  );
}
