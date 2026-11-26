"use client";

import { useRef, useState } from "react";
import { Button, Card, EmptyState, Icon, StatusPill } from "@/components/ds";
import type { BinAlert, RestockBoard } from "@/lib/expo";
import ScanInput, { ResultBanner, type Banner } from "../ScanInput";
import { buzz, chime, elapsed, postExpo, usePoll } from "../expo-client";

/** Waiting longer than this turns the timer red. */
const URGENT_SECONDS = 120;

/**
 * Phone screen for a restock volunteer. Pickers flag source bins empty from their task; they
 * appear here oldest first with how long they've waited. Refill the bin, then scan its label
 * (or tap Refilled) and the picker who flagged it is told. No runner data: bin codes only.
 */
export default function RestockStation({ eventId }: { eventId: string }) {
  const [board, setBoard] = useState<RestockBoard | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);
  const [connError, setConnError] = useState(false);
  const known = useRef<Set<string> | null>(null);

  async function refresh() {
    const sent = Date.now();
    const res = await postExpo<{ board?: RestockBoard; now?: string }>({ action: "restock-board", eventId });
    const received = Date.now();
    setNow(received);
    if (!res.ok || !res.board) {
      setConnError(true);
      return;
    }
    setConnError(false);
    if (res.now) setOffset(Date.parse(res.now) - (sent + received) / 2);
    const ids = new Set(res.board.open.map((a) => a.id));
    // A new empty bin since the last poll (not on the first load).
    if (known.current && [...ids].some((id) => !known.current!.has(id))) {
      chime();
      buzz(400);
    }
    known.current = ids;
    setBoard(res.board);
  }
  usePoll(refresh, 3000);
  usePoll(async () => setNow(Date.now()), 1000, (board?.open.length ?? 0) > 0);

  async function refilled(bin: string) {
    setBusy(true);
    const res = await postExpo({ action: "bin-refilled", eventId, bin: bin.trim().toUpperCase() });
    setBusy(false);
    if (!res.ok) buzz();
    setBanner({ ok: res.ok, text: res.message ?? (res.ok ? "Refilled" : "Try again") });
    await refresh();
  }

  if (!board) {
    return (
      <Card>
        <p className="text-14 text-ink-muted">{connError ? "Can't reach the server: retrying…" : "Loading…"}</p>
      </Card>
    );
  }

  const serverNow = now + offset;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-18 font-semibold text-ink">
              {board.open.length === 0 ? "All bins stocked" : `${board.open.length} empty bin${board.open.length === 1 ? "" : "s"}`}
            </p>
            <p className="text-14 text-ink-tertiary">Refill the bin, then scan its label.</p>
          </div>
          {connError && <StatusPill tone="expired">Retrying</StatusPill>}
        </div>
        <div className="mt-4">
          <ScanInput label="Scan the refilled bin's label" onScan={refilled} disabled={busy} />
        </div>
      </Card>

      <ResultBanner banner={banner} />

      {board.open.length === 0 ? (
        <Card>
          <EmptyState title="Nothing to refill. You'll hear a chime when a picker flags a bin." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {board.open.map((a) => (
            <AlertRow key={a.id} alert={a} serverNow={serverNow} busy={busy} onRefilled={() => refilled(a.bin)} />
          ))}
        </ul>
      )}

      {board.recent.length > 0 && (
        <Card title="Recently refilled">
          <ul className="divide-y divide-line-secondary">
            {board.recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-mono text-16 font-semibold text-ink">{a.bin}</span>
                <span className="text-12 text-ink-tertiary">
                  {a.resolvedAt ? new Date(a.resolvedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function AlertRow({ alert, serverNow, busy, onRefilled }: { alert: BinAlert; serverNow: number; busy: boolean; onRefilled: () => void }) {
  const waited = Math.max(0, Math.floor((serverNow - Date.parse(alert.raisedAt)) / 1000));
  const urgent = waited >= URGENT_SECONDS;
  return (
    <li className={`rounded-12 border-2 p-4 ${urgent ? "border-[#FDA29B] bg-tint-red" : "border-[#F7B27A] bg-tint-orange"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-24 font-semibold text-ink">{alert.bin}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-14 text-ink-secondary">
            <Icon name="clock" size={16} className="shrink-0" />
            Waiting{" "}
            <span className={`font-mono font-semibold tabular-nums ${urgent ? "text-[#B42318]" : "text-ink"}`}>
              {elapsed(alert.raisedAt, serverNow)}
            </span>
            {alert.reports > 1 && <span className="text-ink-tertiary">· flagged {alert.reports}×</span>}
          </p>
        </div>
        <Button variant="dark" onClick={onRefilled} disabled={busy} className="h-12! shrink-0 px-5!">
          <Icon name="check" size={18} />
          Refilled
        </Button>
      </div>
    </li>
  );
}
