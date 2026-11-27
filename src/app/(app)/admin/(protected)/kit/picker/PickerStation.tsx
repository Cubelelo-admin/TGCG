"use client";

import { useRef, useState } from "react";
import { Button, Card, Checkbox, Icon, StatusPill } from "@/components/ds";
import type { ExpoKind, PickerBin, PickerState, PickerTask } from "@/lib/expo";
import ScanInput, { ResultBanner, type Banner } from "../ScanInput";
import { KIND_LABEL, buzz, chime, postExpo, useLatestReply, usePoll } from "../expo-client";

const ALL_KINDS: ExpoKind[] = ["bib", "tshirt", "pack"];

/**
 * Phone screen for a warehouse picker. Active → tasks are offered here one at a time
 * (60 s to accept). Accepted → scan each source bin (only then the sizes / BIBs show),
 * pick, then scan the crate to put away. Sees no runner names or contact details.
 */
export default function PickerStation({ eventId }: { eventId: string }) {
  const [state, setState] = useState<PickerState | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);
  const [specialties, setSpecialties] = useState<ExpoKind[] | null>(null);
  const [connError, setConnError] = useState(false);
  const lastTaskId = useRef<string | null>(null);
  const wasActive = useRef<boolean | null>(null);
  // True while paused by their own Pause, so it never reads as "you were paused". (Setting
  // wasActive wasn't enough: a poll sent before Pause usually lands after it and resets it.)
  const pausedByMe = useRef(false);
  // Bins of the current task with an open "empty" alert, to announce the refill.
  const emptyBins = useRef<Set<string>>(new Set());
  const latest = useLatestReply();
  // When the banner was last set: a new offer clears an old banner, not one just shown.
  const bannerAt = useRef(0);
  function showBanner(b: Banner) {
    bannerAt.current = Date.now();
    setBanner(b);
  }

  async function refresh() {
    const ticket = latest.begin();
    const sent = Date.now();
    const res = await postExpo<{ state?: PickerState; now?: string }>({ action: "picker-state", eventId });
    const received = Date.now();
    // A poll that left before the last action and came back after it: its state is old.
    if (latest.isStale(ticket)) return;
    setNow(received);
    if (!res.ok || !res.state) {
      setConnError(true);
      return;
    }
    setConnError(false);
    // Server-vs-phone clock difference, so the offer countdown matches the server's 60 s.
    if (res.now) setOffset(Date.parse(res.now) - (sent + received) / 2);

    const next = res.state;
    if (next.task?.status === "offered" && next.task.id !== lastTaskId.current) {
      chime();
      buzz(400);
      // "Put away" from the last task (or any older message) doesn't belong to this offer.
      if (Date.now() - bannerAt.current > 4000) setBanner(null);
    }
    // Paused by the server: an offer ran out, or the supervisor released the task.
    if (wasActive.current && next.picker && !next.picker.active && !busy && !pausedByMe.current) {
      showBanner({
        ok: false,
        text: "You were paused: an offer ran out or the supervisor took the task back. Tap Start when you're ready again.",
      });
    }
    // Restock refilled a bin this picker flagged.
    const nowEmpty = new Set((next.task?.bins ?? []).filter((b) => b.empty).map((b) => b.code));
    if (next.task?.id === lastTaskId.current) {
      const refilled = [...emptyBins.current].filter((c) => !nowEmpty.has(c));
      if (refilled.length > 0) {
        chime();
        buzz(300);
        showBanner({ ok: true, text: `${refilled.join(", ")} refilled: scan it again` });
      }
    }
    emptyBins.current = nowEmpty;
    lastTaskId.current = next.task?.id ?? null;
    wasActive.current = next.picker?.active ?? false;
    setState(next);
  }
  usePoll(refresh, 2000);
  // A 1 s tick for the countdown between polls.
  usePoll(async () => setNow(Date.now()), 1000, state?.task?.status === "offered");

  const active = state?.picker?.active ?? false;
  const mySpecialties = specialties ?? state?.picker?.specialties ?? ALL_KINDS;

  async function act(body: Record<string, unknown>, okText?: string) {
    setBusy(true);
    const res = await postExpo(body);
    setBusy(false);
    if (!res.ok) buzz();
    showBanner({ ok: res.ok, text: res.message ?? (res.ok ? (okText ?? "Done") : "Try again") });
    await refresh();
    return res;
  }

  async function setActive(on: boolean, kinds = mySpecialties) {
    if (!on) pausedByMe.current = true;
    const res = await act({ action: "set-active", eventId, active: on, specialties: kinds });
    // Start worked: their own pause is over. Pause refused (task accepted): they're still active.
    if (on ? res.ok : !res.ok) pausedByMe.current = false;
  }

  if (!state) {
    return (
      <Card>
        <p className="text-14 text-ink-muted">{connError ? "Can't reach the server: retrying…" : "Loading…"}</p>
      </Card>
    );
  }

  const task = state.task;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-18 font-semibold text-ink">{active ? "You're active" : "You're paused"}</p>
            <p className="text-14 text-ink-tertiary">
              {active
                ? task
                  ? "Finish this task to get the next one."
                  : `Waiting for a task · ${state.queued} in the queue`
                : "Tap Start to receive tasks."}
            </p>
          </div>
          {active ? (
            // With an offer on screen, Pause hands it back (0032). An accepted task is finished
            // or given back first.
            <Button onClick={() => setActive(false)} disabled={busy || task?.status === "accepted"} className="h-12! px-5!">
              Pause
            </Button>
          ) : (
            <Button variant="green" onClick={() => setActive(true)} disabled={busy || mySpecialties.length === 0} className="h-12! px-6! text-16!">
              Start
            </Button>
          )}
        </div>
        <div className="mt-4 border-t border-line-secondary pt-3">
          <p className="mb-2 text-12 font-medium uppercase tracking-wide text-ink-tertiary">I pick</p>
          <div className="flex flex-wrap gap-4">
            {ALL_KINDS.map((k) => (
              <Checkbox
                key={k}
                label={KIND_LABEL[k]}
                checked={mySpecialties.includes(k)}
                disabled={busy}
                onChange={(on) => {
                  const next = on ? [...mySpecialties, k] : mySpecialties.filter((x) => x !== k);
                  setSpecialties(next);
                  // Saved straight away while active; otherwise on Start.
                  if (active && next.length > 0) void setActive(true, next);
                }}
              />
            ))}
          </div>
          <p className="mt-2 text-12 text-ink-muted">A task waiting over 90 s can go to anyone free.</p>
        </div>
        {connError && (
          <p className="mt-3">
            <StatusPill tone="expired">Connection problem: retrying</StatusPill>
          </p>
        )}
      </Card>

      <ResultBanner banner={banner} />

      {task?.status === "offered" && (
        <OfferCard task={task} secondsLeft={secondsLeft(task.offerExpiresAt, now + offset)} busy={busy} onAccept={() => act({ action: "accept", taskId: task.id }, "Accepted")} onDecline={() => act({ action: "decline", taskId: task.id })} />
      )}
      {task?.status === "accepted" && (
        <TaskCard
          task={task}
          busy={busy}
          banner={banner}
          onScan={(v) => onTaskScan(task, v)}
          onBinEmpty={(bin) => {
            if (window.confirm(`Is ${bin.code} empty? Restock will be told to refill it.`)) {
              void act({ action: "bin-empty", taskId: task.id, bin: bin.code });
            }
          }}
          onPickBulk={(bin) => act({ action: "pick-item", taskId: task.id, lineIds: bin.lines.filter((l) => !l.picked).map((l) => l.lineId) }, "Picked")}
          onGiveBack={() => {
            if (window.confirm("Give this task back? It goes to another picker.")) void act({ action: "decline", taskId: task.id });
          }}
        />
      )}
    </div>
  );

  /** One scan field for the whole task: bin label → open it; BIB → pick it; crate → put away. */
  async function onTaskScan(t: PickerTask, raw: string) {
    const value = raw.trim().toUpperCase();
    if (t.allPicked) {
      await act({ action: "put-away", taskId: t.id, crate: value });
      return;
    }
    if (t.bins.some((b) => b.code.toUpperCase() === value)) {
      await act({ action: "pick-bin", taskId: t.id, bin: value });
      return;
    }
    if (t.kind === "bib") {
      const line = t.bins.flatMap((b) => b.lines).find((l) => !l.picked && l.bib?.toUpperCase() === value);
      if (line) {
        await act({ action: "pick-item", taskId: t.id, lineIds: [line.lineId], scan: value }, `BIB ${value} picked`);
        return;
      }
      if (t.bins.some((b) => b.opened)) {
        buzz();
        showBanner({ ok: false, text: `WRONG BIB: ${value} isn't in this order` });
        return;
      }
    }
    // Unknown code: the server explains (wrong bin / nothing to pick).
    await act({ action: "pick-bin", taskId: t.id, bin: value });
  }
}

function secondsLeft(expiresAt: string | null, serverNow: number) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - serverNow) / 1000));
}

function itemsText(task: PickerTask) {
  const n = task.bins.reduce((s, b) => s + b.count, 0);
  return `${n} ${KIND_LABEL[task.kind]}${n === 1 ? "" : "s"}`;
}

function OfferCard({
  task,
  secondsLeft,
  busy,
  onAccept,
  onDecline,
}: {
  task: PickerTask;
  secondsLeft: number;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <section className="rounded-12 border-2 border-[#F7B27A] bg-tint-orange p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-12 font-medium uppercase tracking-wide text-on-tint-orange">New task · {task.orderCode}</p>
          <p className="mt-1 text-32 font-semibold text-ink">{itemsText(task)}</p>
          <p className="mt-1 text-14 text-ink-secondary">From {task.bins.map((b) => b.code).join(", ")}</p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-32 font-semibold tabular-nums ${secondsLeft <= 15 ? "text-[#D92D20]" : "text-ink"}`}>{secondsLeft}s</p>
          <p className="text-12 text-ink-tertiary">to accept</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[2fr_1fr] gap-2">
        <Button variant="dark" onClick={onAccept} disabled={busy || secondsLeft === 0} className="h-14! text-18!">
          <Icon name="check" size={20} />
          Accept
        </Button>
        <Button onClick={onDecline} disabled={busy} className="h-14!">
          Decline
        </Button>
      </div>
    </section>
  );
}

function TaskCard({
  task,
  busy,
  banner,
  onScan,
  onPickBulk,
  onBinEmpty,
  onGiveBack,
}: {
  task: PickerTask;
  busy: boolean;
  banner: Banner;
  onScan: (v: string) => Promise<void>;
  onPickBulk: (bin: PickerBin) => void;
  onBinEmpty: (bin: PickerBin) => void;
  onGiveBack: () => void;
}) {
  const openBib = task.kind === "bib" && task.bins.some((b) => b.opened && b.picked < b.count);
  const label = task.allPicked
    ? `Walk to crate ${task.crate ?? ""} and scan its label`
    : openBib
      ? "Scan each BIB (or the next bin label)"
      : "Scan a bin label";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-12 font-medium uppercase tracking-wide text-ink-tertiary">{task.orderCode}</p>
            <p className="text-24 font-semibold text-ink">{itemsText(task)}</p>
          </div>
          <div className="text-right">
            <p className="text-12 text-ink-tertiary">Put in crate</p>
            <p className="font-mono text-24 font-semibold text-ink">{task.crate ?? "—"}</p>
          </div>
        </div>
        <div className="mt-4">
          <ScanInput label={label} onScan={onScan} disabled={busy} continuous feedback={banner} />
        </div>
      </Card>

      {task.allPicked ? (
        <section className="rounded-12 bg-tint-green p-5 text-center">
          <Icon name="checkCircle" size={32} className="mx-auto text-on-tint-green" />
          <p className="mt-2 text-18 font-semibold text-on-tint-green">All picked</p>
          <p className="mt-1 text-14 text-ink-secondary">
            Take everything to crate <span className="font-mono font-semibold">{task.crate}</span> and scan the crate label.
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {task.bins.map((b) => (
            <BinRow key={b.code} bin={b} kind={task.kind} busy={busy} onPickBulk={() => onPickBulk(b)} onEmpty={() => onBinEmpty(b)} />
          ))}
        </ul>
      )}

      <Button onClick={onGiveBack} disabled={busy} className="w-full">
        Can&apos;t finish: give this task back
      </Button>
    </div>
  );
}

function BinRow({
  bin,
  kind,
  busy,
  onPickBulk,
  onEmpty,
}: {
  bin: PickerBin;
  kind: ExpoKind;
  busy: boolean;
  onPickBulk: () => void;
  onEmpty: () => void;
}) {
  const done = bin.picked === bin.count;
  const left = bin.count - bin.picked;
  return (
    <li className={`rounded-12 border p-4 ${done ? "border-[#ABEFC6] bg-tint-green" : bin.opened ? "border-dark bg-white" : "border-line bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="break-all font-mono text-20 font-semibold text-ink">{bin.code}</span>
        {done ? (
          <StatusPill tone="active">Picked</StatusPill>
        ) : bin.opened ? (
          <StatusPill tone="info">
            {bin.picked}/{bin.count} picked
          </StatusPill>
        ) : (
          <StatusPill tone="pending">Scan bin · {bin.count}</StatusPill>
        )}
      </div>

      {!done &&
        (bin.empty ? (
          <p className="mt-3 flex items-center gap-2 rounded-8 bg-tint-orange px-3 py-2 text-14 font-medium text-on-tint-orange">
            <Icon name="clock" size={18} className="shrink-0" />
            Marked empty: restock is on the way. Wait here or give the task back.
          </p>
        ) : (
          <button
            type="button"
            onClick={onEmpty}
            disabled={busy}
            className="mt-3 text-14 font-medium text-[#B42318] underline underline-offset-2 disabled:text-ink-disabled"
          >
            Bin is empty
          </button>
        ))}

      {bin.opened && !done && kind !== "bib" && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-18 text-ink">
            Take <span className="font-semibold">{left}</span>
            {kind === "tshirt" && bin.lines[0]?.size ? (
              <>
                {" "}× size <span className="font-semibold">{bin.lines[0].size}</span>
              </>
            ) : (
              ` ${left === 1 ? "pack" : "packs"}`
            )}
          </p>
          <Button variant="dark" onClick={onPickBulk} disabled={busy} className="h-12! px-5!">
            Picked {left}
          </Button>
        </div>
      )}

      {bin.opened && kind === "bib" && (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {bin.lines.map((l) => (
            <li
              key={l.lineId}
              className={`rounded-8 px-2 py-2 text-center font-mono text-18 font-semibold ${
                l.picked ? "bg-tint-green text-on-tint-green" : "bg-surface-tertiary text-ink"
              }`}
            >
              {l.bib ?? "?"}
              {l.picked && " ✓"}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
