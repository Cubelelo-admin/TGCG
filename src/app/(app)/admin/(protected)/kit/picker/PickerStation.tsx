"use client";

import { useRef, useState } from "react";
import { Button, Card, Checkbox, Icon, StatusPill } from "@/components/ds";
import type { ExpoKind, PickerState, PickerTask, TaskScanResult } from "@/lib/expo";
import { ResultBanner, alertFrom, type Alert, type AlertTone } from "../ScanInput";
import { KIND_LABEL, buzz, chime, postExpo, useLatestReply, usePoll } from "../expo-client";
import TaskScreen from "./TaskScreen";
import { itemCount } from "./steps";

const ALL_KINDS: ExpoKind[] = ["bib", "tshirt", "pack"];

/** How serious each task-scan answer is (kit_task_scan, 0035; spec §4.3). */
const SCAN_TONE: Record<TaskScanResult, AlertTone> = {
  picked: "done",
  opened: "done",
  bib: "done",
  done: "done",
  already: "warn",
  "bin-first": "warn",
  "not-all-picked": "warn",
  "wrong-pigeonhole": "error",
  "wrong-bib": "error",
  "wrong-bin": "error",
};

type ScanAnswer = { ok: boolean; result?: TaskScanResult; message?: string; hint?: string | null };

/** A task-scan answer as an alert. No result: a refusal (task released, not accepted) or no connection. */
function scanAlert(res: ScanAnswer): Alert {
  if (res.result) return { tone: SCAN_TONE[res.result], title: res.message ?? "", text: res.hint ?? undefined };
  return { ...alertFrom(false, res.message ?? "Try again"), tone: "warn" };
}

/**
 * Phone screen for a warehouse picker. Active → tasks are offered here one at a time (60 s to
 * accept). Accepted → the task screen (TaskScreen): camera on top, one step at a time, every scan
 * sent to task-scan, finished by scanning the pigeonhole. Sees no runner names or contact details.
 */
export default function PickerStation({ eventId }: { eventId: string }) {
  const [state, setState] = useState<PickerState | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [banner, setBanner] = useState<Alert | null>(null);
  const [busy, setBusy] = useState(false);
  const [specialties, setSpecialties] = useState<ExpoKind[] | null>(null);
  const [connError, setConnError] = useState(false);
  // Volunteer pickers: the items the admin assigned (0033). null = an admin, who ticks items here.
  const [assigned, setAssigned] = useState<ExpoKind[] | null>(null);
  // What the last poll said, to spot the admin's changes. undefined = no poll back yet.
  const assignedSeen = useRef<ExpoKind[] | null | undefined>(undefined);
  // An assignment change, shown until dismissed (×).
  const [note, setNote] = useState<Alert | null>(null);
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
  function showBanner(b: Alert | null) {
    bannerAt.current = Date.now();
    setBanner(b);
  }

  async function refresh() {
    const ticket = latest.begin();
    const sent = Date.now();
    const res = await postExpo<{ state?: PickerState; now?: string; assigned?: ExpoKind[] | null }>({
      action: "picker-state",
      eventId,
    });
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
    // The admin changed this picker's items (0033). Not on the first poll: that's just loading.
    const nextAssigned = res.assigned ?? null;
    const before = assignedSeen.current;
    const itemsRemoved = Array.isArray(before) && before.length > 0 && nextAssigned !== null && nextAssigned.length === 0;
    if (Array.isArray(before) && nextAssigned !== null && before.join() !== nextAssigned.join()) {
      setNote(
        nextAssigned.length === 0
          ? {
              tone: "warn",
              title: "Your items were removed",
              text:
                next.task?.status === "accepted"
                  ? "Finish the task on your screen. After that you're paused until the supervisor assigns new ones."
                  : "You're paused until the supervisor assigns new ones.",
            }
          : {
              tone: "note",
              title: `Your items are now ${nextAssigned.map((k) => KIND_LABEL[k]).join(" · ")}`,
              text: "Set by the supervisor. A task already on your screen carries on.",
            }
      );
    }
    assignedSeen.current = nextAssigned;
    setAssigned(nextAssigned);
    if (next.task?.status === "offered" && next.task.id !== lastTaskId.current) {
      chime();
      buzz(400);
      // "Task done" from the last task (or any older message) doesn't belong to this offer.
      if (Date.now() - bannerAt.current > 4000) setBanner(null);
    }
    // Paused by the server: an offer ran out, or the supervisor released the task. (Items removed:
    // the note says so instead.)
    if (wasActive.current && next.picker && !next.picker.active && !busy && !pausedByMe.current && !itemsRemoved) {
      showBanner({
        tone: "warn",
        title: "You were paused",
        text: "An offer ran out or the supervisor took the task back. Tap Start when you're ready again.",
      });
    }
    // Restock refilled a bin this picker flagged.
    const nowEmpty = new Set((next.task?.bins ?? []).filter((b) => b.empty).map((b) => b.code));
    if (next.task?.id === lastTaskId.current) {
      const refilled = [...emptyBins.current].filter((c) => !nowEmpty.has(c));
      if (refilled.length > 0) {
        chime();
        buzz(300);
        showBanner({ tone: "note", title: `${refilled.join(", ")} refilled`, text: "Carry on with the step on screen." });
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
  // A volunteer picks the items the admin assigned; an admin previewing ticks their own.
  const isVolunteer = assigned !== null;
  const mySpecialties = assigned ?? specialties ?? state?.picker?.specialties ?? ALL_KINDS;

  /**
   * Start, Pause, Accept, Decline, Give back, Bin is empty. A refusal is a warning (amber).
   * okTone: the alert when it works; null = none (Bin is empty: the step itself says so).
   */
  async function act(body: Record<string, unknown>, okTone: AlertTone | null = "done", okText?: string) {
    setBusy(true);
    const res = await postExpo(body);
    setBusy(false);
    if (!res.ok) {
      buzz();
      showBanner({ ...alertFrom(false, res.message ?? "Try again"), tone: "warn" });
    } else {
      showBanner(okTone ? { ...alertFrom(true, okText ?? res.message ?? "Done"), tone: okTone } : null);
    }
    await refresh();
    return res;
  }

  async function setActive(on: boolean, kinds = mySpecialties) {
    if (!on) pausedByMe.current = true;
    // A volunteer's items come from the server (0033); only an admin sends ticks.
    const res = await act({ action: "set-active", eventId, active: on, ...(isVolunteer ? {} : { specialties: kinds }) });
    // Start worked: their own pause is over. Pause refused: they're still active.
    if (on ? res.ok : !res.ok) pausedByMe.current = false;
  }

  /** One scan during the task (camera, typed or hardware): one task-scan call. True = it moved the task on. */
  async function onTaskScan(t: PickerTask, code: string) {
    setBusy(true);
    const res = await postExpo<ScanAnswer>({ action: "task-scan", taskId: t.id, code });
    setBusy(false);
    const alert = scanAlert(res);
    if (alert.tone === "error") buzz();
    showBanner(alert);
    // The next step shows when this lands; the camera already reads the next code meanwhile.
    void refresh();
    return res.ok;
  }

  if (!state) {
    return (
      <Card>
        <p className="text-14 text-ink-muted">{connError ? "Can't reach the server: retrying…" : "Loading…"}</p>
      </Card>
    );
  }

  const task = state.task;

  // During a task the screen splits (camera on top, one step at a time). Start / Pause come back after it.
  if (task?.status === "accepted") {
    return (
      <TaskScreen
        key={task.id}
        task={task}
        alert={banner}
        note={note}
        onDismissNote={() => setNote(null)}
        connError={connError}
        busy={busy}
        onScan={(code) => onTaskScan(task, code)}
        onBinEmpty={(bin) => {
          if (window.confirm(`Is ${bin.code} empty? Restock will be told to refill it.`)) {
            void act({ action: "bin-empty", taskId: task.id, bin: bin.code }, null);
          }
        }}
        onGiveBack={() => {
          if (window.confirm("Give this task back? It goes to another picker.")) {
            void act({ action: "decline", taskId: task.id }, "note", "Given back: it goes to another picker");
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ResultBanner banner={note} onDismiss={() => setNote(null)} />
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
            // With an offer on screen, Pause hands it back (0032).
            <Button onClick={() => setActive(false)} disabled={busy} className="h-12! px-5!">
              Pause
            </Button>
          ) : (
            <Button variant="green" onClick={() => setActive(true)} disabled={busy || mySpecialties.length === 0} className="h-12! px-6! text-16!">
              Start
            </Button>
          )}
        </div>
        <div className="mt-4 border-t border-line-secondary pt-3">
          {isVolunteer ? (
            <>
              <p className="mb-2 text-12 font-medium uppercase tracking-wide text-ink-tertiary">Your items</p>
              {mySpecialties.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {mySpecialties.map((k) => (
                      <StatusPill key={k} tone="pending">
                        {KIND_LABEL[k]}
                      </StatusPill>
                    ))}
                  </div>
                  <p className="mt-2 text-12 text-ink-muted">
                    Set by the supervisor. A task waiting over 90 s can go to anyone free.
                  </p>
                </>
              ) : (
                <ResultBanner
                  banner={{ tone: "warn", title: "No items assigned yet", text: "Ask the supervisor. Start unlocks once they assign some." }}
                />
              )}
            </>
          ) : (
            <>
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
              <p className="mt-2 text-12 text-ink-muted">
                Admin preview: tick items to test. A task waiting over 90 s can go to anyone free.
              </p>
            </>
          )}
        </div>
        {connError && (
          <p className="mt-3">
            <StatusPill tone="expired">Connection problem: retrying</StatusPill>
          </p>
        )}
      </Card>

      <ResultBanner banner={banner} />

      {task?.status === "offered" && (
        <OfferCard
          task={task}
          notMine={!mySpecialties.includes(task.kind)}
          secondsLeft={secondsLeft(task.offerExpiresAt, now + offset)}
          busy={busy}
          onAccept={() => act({ action: "accept", taskId: task.id }, "done", "Accepted")}
          onDecline={() => act({ action: "decline", taskId: task.id }, "note")}
        />
      )}
    </div>
  );
}

function secondsLeft(expiresAt: string | null, serverNow: number) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - serverNow) / 1000));
}

function OfferCard({
  task,
  notMine,
  secondsLeft,
  busy,
  onAccept,
  onDecline,
}: {
  task: PickerTask;
  /** Overflow: a task for an item this picker wasn't given, sent because it waited over 90 s. */
  notMine: boolean;
  secondsLeft: number;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const count = task.bins.reduce((s, b) => s + b.count, 0);
  return (
    <section className="rounded-12 border-2 border-[#F7B27A] bg-tint-orange p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-12 font-medium uppercase tracking-wide text-on-tint-orange">New task · {task.orderCode}</p>
          <p className="mt-1 text-32 font-semibold text-ink">{itemCount(task.kind, count)}</p>
          <p className="mt-1 text-14 text-ink-secondary">From {task.bins.map((b) => b.code).join(", ")}</p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-32 font-semibold tabular-nums ${secondsLeft <= 15 ? "text-[#D92D20]" : "text-ink"}`}>{secondsLeft}s</p>
          <p className="text-12 text-ink-tertiary">to accept</p>
        </div>
      </div>
      {notMine && (
        <ResultBanner
          className="mt-3"
          banner={{ tone: "warn", title: "Not one of your items", text: "It has waited over 90 s, so any free picker can take it." }}
        />
      )}
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
