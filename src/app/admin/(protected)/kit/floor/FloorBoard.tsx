"use client";

import { useRef, useState } from "react";
import { Button, Card, EmptyState, Icon, KpiCard, Modal, StatusPill, type StatusTone } from "@/components/ds";
import type { ExpoKind, FloorBoard as Board, FloorOrder, FloorPicker, FloorTask } from "@/lib/expo";
import { ResultBanner, type Banner } from "../ScanInput";
import { CancelModal } from "../desk/DeskStation";
import { KIND_LABEL, buzz, chime, elapsed, postExpo, usePoll } from "../expo-client";

/** An accepted task older than this is flagged stuck (design doc: 5-min soft timeout). */
const STUCK_ACCEPTED_S = 5 * 60;
/** A queued task waiting longer than this means no picker can take it. */
const QUEUED_WAIT_S = 90;
/** A ready order not handed over after this long. */
const READY_WAIT_S = 5 * 60;
/** An empty bin waiting longer than this turns red. */
const BIN_URGENT_S = 120;

type Issue = {
  key: string;
  red: boolean;
  title: string;
  detail: string;
  since: string;
  action?: { kind: "release"; task: FloorTask; orderCode: string } | { kind: "refill"; bin: string };
};

const secondsSince = (iso: string | null, now: number) => (iso ? Math.max(0, (now - Date.parse(iso)) / 1000) : 0);

/**
 * Supervisor screen: every open order, picker, crate and empty bin on one page, with the
 * things that need a person at the top (stuck tasks, tasks no picker can take, ready orders
 * not handed over, empty bins, desks out of crates). Release pulls a task back from a picker
 * who has gone quiet: it goes to the next free picker and the quiet one is paused.
 */
export default function FloorBoard({ eventId }: { eventId: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [connError, setConnError] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [releasing, setReleasing] = useState<{ task: FloorTask; orderCode: string; picker: string } | null>(null);
  const [cancelling, setCancelling] = useState<FloorOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const redKeys = useRef<Set<string> | null>(null);

  async function refresh() {
    const sent = Date.now();
    const res = await postExpo<{ board?: Board; now?: string }>({ action: "floor-board", eventId });
    const received = Date.now();
    setNow(received);
    if (!res.ok || !res.board) {
      setConnError(true);
      return;
    }
    setConnError(false);
    const off = res.now ? Date.parse(res.now) - (sent + received) / 2 : offset;
    setOffset(off);
    // Chime when something new turns red (not on the first load).
    const reds = new Set(findIssues(res.board, received + off).filter((i) => i.red).map((i) => i.key));
    if (redKeys.current && [...reds].some((k) => !redKeys.current!.has(k))) {
      chime();
      buzz(300);
    }
    redKeys.current = reds;
    setBoard(res.board);
  }
  usePoll(refresh, 3000);
  usePoll(async () => setNow(Date.now()), 1000);

  const serverNow = now + offset;
  const pickerName = new Map((board?.pickers ?? []).map((p) => [p.id, p.name]));

  function askRelease(task: FloorTask, orderCode: string) {
    setReleasing({ task, orderCode, picker: (task.pickerId && pickerName.get(task.pickerId)) || "the picker" });
  }

  async function release() {
    if (!releasing) return;
    setBusy(true);
    const res = await postExpo({ action: "release-task", taskId: releasing.task.id });
    setBusy(false);
    setReleasing(null);
    setBanner({
      ok: res.ok,
      text: res.ok
        ? `${KIND_LABEL[releasing.task.kind]} task of ${releasing.orderCode} released: it goes to the next free picker`
        : (res.message ?? "Could not release"),
    });
    await refresh();
  }

  async function refilled(bin: string) {
    setBusy(true);
    const res = await postExpo({ action: "bin-refilled", eventId, bin });
    setBusy(false);
    setBanner({ ok: res.ok, text: res.message ?? (res.ok ? `${bin} refilled` : "Try again") });
    await refresh();
  }

  const issues = board ? findIssues(board, serverNow) : [];

  if (!board) {
    return (
      <Card>
        <p className="text-14 text-ink-muted">{connError ? "Can't reach the server: retrying…" : "Loading…"}</p>
      </Card>
    );
  }

  const picking = board.orders.filter((o) => o.status === "picking").length;
  const ready = board.orders.length - picking;
  const active = board.pickers.filter((p) => p.active || p.task);
  const busyPickers = board.pickers.filter((p) => p.task).length;
  const queued = board.orders.reduce((n, o) => n + o.tasks.filter((t) => t.status === "queued").length, 0);

  return (
    <div className="flex flex-col gap-4">
      {connError && (
        <div>
          <StatusPill tone="expired">Connection lost: retrying</StatusPill>
        </div>
      )}

      {/* KpiRow squeezes six tiles on a phone: a grid wraps them instead. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Being picked" value={picking} tone="blue" caption={queued ? `${queued} task${queued === 1 ? "" : "s"} waiting for a picker` : "No task waiting"} />
        <KpiCard label="Ready at desk" value={ready} tone={ready ? "green" : "default"} caption="Waiting for handover" />
        <KpiCard
          label="Handed over"
          value={board.handedOver.total}
          tone="bordered"
          caption={`${board.handedOver.lastHour} in the last hour`}
        />
        <KpiCard
          label="Pickers busy"
          value={`${busyPickers}/${active.length}`}
          tone="bordered"
          caption={active.length ? `${active.length - busyPickers} free` : "Nobody is active"}
        />
        <KpiCard
          label="Avg. to handover"
          value={board.avgMinutes.toHandover === null ? "–" : `${board.avgMinutes.toHandover} min`}
          tone="bordered"
          caption={board.avgMinutes.toReady === null ? "Last 20 orders" : `${board.avgMinutes.toReady} min to ready · last 20`}
        />
        <KpiCard
          label="Empty bins"
          value={board.alerts.length}
          tone={board.alerts.length ? "orange" : "default"}
          caption={board.alerts.length ? "Restock is notified" : "All bins stocked"}
        />
      </div>

      <ResultBanner banner={banner} />

      <Card title={issues.length ? `Needs attention (${issues.length})` : "Needs attention"}>
        {issues.length === 0 ? (
          <EmptyState title="Nothing stuck. Tasks, crates and bins are all moving." />
        ) : (
          <ul className="flex flex-col gap-2">
            {issues.map((i) => (
              <li
                key={i.key}
                className={`flex flex-wrap items-center gap-3 rounded-8 border px-4 py-3 ${
                  i.red ? "border-[#FDA29B] bg-tint-red" : "border-[#F7B27A] bg-tint-orange"
                }`}
              >
                <Icon name={i.red ? "alert" : "clock"} size={18} className={i.red ? "text-[#B42318]" : "text-[#B54708]"} />
                <div className="min-w-0 flex-1">
                  <p className="text-14 font-semibold text-ink">{i.title}</p>
                  <p className="text-12 text-ink-secondary">
                    {i.detail} ·{" "}
                    <span className="font-mono font-semibold tabular-nums text-ink">{elapsed(i.since, serverNow)}</span>
                  </p>
                </div>
                {i.action && (
                  <Button
                    size="sm"
                    variant={i.red ? "dark" : "outline"}
                    onClick={() => {
                      const a = i.action!;
                      if (a.kind === "release") askRelease(a.task, a.orderCode);
                      else void refilled(a.bin);
                    }}
                    disabled={busy}
                  >
                    {i.action.kind === "release" ? "Release" : "Refilled"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <OrdersCard
          orders={board.orders}
          pickerName={pickerName}
          serverNow={serverNow}
          onRelease={askRelease}
          onCancel={setCancelling}
        />
        <div className="flex flex-col gap-4">
          <PickersCard pickers={board.pickers} serverNow={serverNow} onRelease={askRelease} />
          <CratesCard crates={board.crates} />
        </div>
      </div>

      <Modal
        open={releasing !== null}
        title={releasing ? `Release the ${KIND_LABEL[releasing.task.kind]} task of ${releasing.orderCode}?` : ""}
        subtitle={releasing ? `Takes it from ${releasing.picker} and offers it to the next free picker.` : undefined}
        icon="undo"
        onClose={() => setReleasing(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setReleasing(null)} disabled={busy}>
              Keep with picker
            </Button>
            <Button variant="dark" onClick={release} disabled={busy}>
              {busy ? "Releasing…" : "Release task"}
            </Button>
          </div>
        }
      >
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-14 text-ink-secondary">
          <li>{releasing?.picker ?? "The picker"} is paused: they tap Active on their phone to get tasks again.</li>
          <li>Anything they already took for this task goes back to its bin. Items already in the crate stay.</li>
        </ul>
      </Modal>

      <CancelModal
        order={cancelling}
        onClose={() => setCancelling(null)}
        onDone={(text, ok) => {
          setCancelling(null);
          setBanner({ ok, text });
          void refresh();
        }}
      />
    </div>
  );
}

function findIssues(board: Board, now: number): Issue[] {
  const out: Issue[] = [];
  const name = new Map(board.pickers.map((p) => [p.id, p.name]));
  const free = board.pickers.filter((p) => p.active && !p.task);
  const anyActive = board.pickers.some((p) => p.active || p.task);

  for (const o of board.orders) {
    for (const t of o.tasks) {
      if (t.status === "accepted" && secondsSince(t.acceptedAt, now) >= STUCK_ACCEPTED_S) {
        out.push({
          key: `stuck:${t.id}`,
          red: true,
          title: `${o.code} · ${KIND_LABEL[t.kind]} stuck with ${(t.pickerId && name.get(t.pickerId)) || "a picker"}`,
          detail: `Desk ${o.station}, crate ${o.crate ?? "–"}. Accepted`,
          since: t.acceptedAt!,
          action: { kind: "release", task: t, orderCode: o.code },
        });
      }
      if (t.status === "queued" && secondsSince(t.queuedAt, now) >= QUEUED_WAIT_S) {
        const why = !anyActive
          ? "No picker is active"
          : free.length === 0
            ? "Every active picker is busy"
            : "Free pickers declined it or let it lapse";
        out.push({
          key: `queued:${t.id}`,
          red: false,
          title: `${o.code} · ${KIND_LABEL[t.kind]} waiting for a picker`,
          detail: `${why}. Waiting`,
          since: t.queuedAt,
        });
      }
    }
    if (o.status === "ready" && o.readyAt && secondsSince(o.readyAt, now) >= READY_WAIT_S) {
      out.push({
        key: `ready:${o.id}`,
        red: false,
        title: `${o.code} ready in crate ${o.crate ?? "–"}, not handed over`,
        detail: `Desk ${o.station}: is the runner still there? Ready`,
        since: o.readyAt,
      });
    }
  }

  for (const a of board.alerts) {
    out.push({
      key: `bin:${a.id}`,
      red: secondsSince(a.raisedAt, now) >= BIN_URGENT_S,
      title: `Bin ${a.bin} is empty${a.reports > 1 ? ` (flagged ${a.reports}×)` : ""}`,
      detail: `Flagged by ${a.raisedBy}${a.orderCode ? ` on ${a.orderCode}` : ""}. Waiting`,
      since: a.raisedAt,
      action: { kind: "refill", bin: a.bin },
    });
  }

  for (const c of board.crates) {
    if (c.small.total + c.large.total > 0 && c.small.free + c.large.free === 0) {
      // Oldest open order at that desk = how long it has been full, at most.
      const oldest = board.orders.find((o) => o.station === c.station);
      out.push({
        key: `crates:${c.station}`,
        red: false,
        title: `Desk ${c.station} has no free crate`,
        detail: "New orders there are refused until one is handed over. Oldest order",
        since: oldest?.createdAt ?? new Date(now).toISOString(),
      });
    }
  }

  // Red first, then whatever has waited longest.
  return out.sort((a, b) => Number(b.red) - Number(a.red) || Date.parse(a.since) - Date.parse(b.since));
}

const TASK_TONE: Record<FloorTask["status"], StatusTone> = {
  queued: "pending",
  offered: "info",
  accepted: "warning",
  done: "active",
  cancelled: "expired",
};

function taskText(t: FloorTask, pickerName: Map<string, string>) {
  const who = t.pickerId ? pickerName.get(t.pickerId) : null;
  if (t.status === "queued") return "waiting";
  if (t.status === "offered") return `offered${who ? ` to ${who}` : ""}`;
  if (t.status === "accepted") return who ?? "picking";
  return "in crate";
}

function OrdersCard({
  orders,
  pickerName,
  serverNow,
  onRelease,
  onCancel,
}: {
  orders: FloorOrder[];
  pickerName: Map<string, string>;
  serverNow: number;
  onRelease: (task: FloorTask, orderCode: string) => void;
  onCancel: (o: FloorOrder) => void;
}) {
  return (
    <Card title={`Open orders (${orders.length})`}>
      {orders.length === 0 ? (
        <EmptyState title="No open orders." />
      ) : (
        <div className="relative -mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-14">
            <thead className="border-b border-line-secondary text-12 text-ink-tertiary">
              <tr>
                <th className="px-5 py-2 font-medium">Order</th>
                <th className="px-2 py-2 font-medium">Crate</th>
                <th className="px-2 py-2 font-medium">Tasks</th>
                <th className="px-2 py-2 text-right font-medium">Age</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-secondary">
              {orders.map((o) => (
                <tr key={o.id} className="align-top">
                  <td className="px-5 py-3">
                    <p className="font-mono font-semibold text-ink">{o.code}</p>
                    <p className="text-12 text-ink-tertiary">
                      Desk {o.station} · {o.runners} runner{o.runners === 1 ? "" : "s"}
                    </p>
                  </td>
                  <td className="px-2 py-3">
                    <p className="font-mono text-ink">{o.crate ?? "–"}</p>
                    {o.status === "ready" && <StatusPill tone="active">Ready</StatusPill>}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {o.tasks.map((t) =>
                        t.status === "offered" || t.status === "accepted" ? (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onRelease(t, o.code)}
                            title="Release this task"
                            className="rounded-4 focus-visible:outline-2"
                          >
                            <StatusPill tone={TASK_TONE[t.status]}>
                              {KIND_LABEL[t.kind]}: {taskText(t, pickerName)}
                            </StatusPill>
                          </button>
                        ) : (
                          <StatusPill key={t.id} tone={TASK_TONE[t.status]}>
                            {KIND_LABEL[t.kind]}: {taskText(t, pickerName)}
                          </StatusPill>
                        )
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right font-mono tabular-nums text-ink-secondary">{elapsed(o.createdAt, serverNow)}</td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="red" onClick={() => onCancel(o)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const SPECIALTY_ORDER: ExpoKind[] = ["bib", "tshirt", "pack"];

function PickersCard({
  pickers,
  serverNow,
  onRelease,
}: {
  pickers: FloorPicker[];
  serverNow: number;
  onRelease: (task: FloorTask, orderCode: string) => void;
}) {
  return (
    <Card title={`Pickers (${pickers.length})`}>
      {pickers.length === 0 ? (
        <EmptyState title="No picker has signed in yet." />
      ) : (
        <ul className="divide-y divide-line-secondary">
          {pickers.map((p) => {
            const t = p.task;
            const stuck = t?.status === "accepted" && secondsSince(t.acceptedAt, serverNow) >= STUCK_ACCEPTED_S;
            return (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-14 font-medium text-ink">{p.name}</p>
                  <p className="text-12 text-ink-tertiary">
                    {SPECIALTY_ORDER.filter((k) => p.specialties.includes(k))
                      .map((k) => KIND_LABEL[k])
                      .join(", ")}
                  </p>
                </div>
                {t ? (
                  <>
                    <StatusPill tone={stuck ? "expired" : t.status === "offered" ? "info" : "warning"}>
                      {t.status === "offered" ? "Offered" : stuck ? "Stuck" : "Picking"} {KIND_LABEL[t.kind]} · {t.orderCode}{" "}
                      <span className="font-mono tabular-nums">{elapsed((t.acceptedAt ?? t.offeredAt)!, serverNow)}</span>
                    </StatusPill>
                    <Button size="sm" variant={stuck ? "dark" : "outline"} onClick={() => onRelease(t, t.orderCode)}>
                      Release
                    </Button>
                  </>
                ) : p.active ? (
                  <StatusPill tone="active">
                    Free <span className="font-mono tabular-nums">{elapsed(p.freeSince, serverNow)}</span>
                  </StatusPill>
                ) : (
                  <StatusPill tone="pending">Inactive</StatusPill>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function CratesCard({ crates }: { crates: Board["crates"] }) {
  return (
    <Card title="Crates free">
      {crates.length === 0 ? (
        <EmptyState title="No crates set up." />
      ) : (
        <ul className="divide-y divide-line-secondary">
          {crates.map((c) => {
            const none = c.small.free + c.large.free === 0;
            return (
              <li key={c.station} className="flex items-center justify-between gap-3 py-2.5 text-14">
                <span className="font-medium text-ink">Desk {c.station}</span>
                <span className={`tabular-nums ${none ? "font-semibold text-[#B42318]" : "text-ink-secondary"}`}>
                  Small {c.small.free}/{c.small.total} · Large {c.large.free}/{c.large.total}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
