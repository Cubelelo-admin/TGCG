"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Banner, Button, Card, Checkbox, EmptyState, Icon, Modal, SegmentedControl, StatusPill, TextField } from "@/components/ds";
import type { DeskBoard, DeskLookup, DeskOrder, DeskRunner } from "@/lib/expo";
import ScanInput, { ResultBanner, alertFrom, type Alert } from "../ScanInput";
import { KIND_LABEL, buzz, chime, elapsed, postExpo, useLatestReply, usePoll } from "../expo-client";

const MAX_RUNNERS = 10;
const STATION_KEY = "tgcg.desk.station";
/** Crate label (D1-S2 / D1-L1) or order code (O-0012): the handover path. Anything else is a runner pass / BIB. */
const HANDOVER_CODE = /^(D\d+-[SL]\d+|O-\d+)$/i;

/**
 * kit_create_order (0030) still says "crate" when the desk is full: "No free [large ]crate at D1:
 * wait for one to be handed over". Changing it would mean replacing the function, so the desk
 * recognises it and words it itself (spec §4.4).
 */
function noFreePigeonhole(message: string): Alert | null {
  const m = /^No free (large )?crate at ([^\s:]+)/.exec(message);
  return m ? { tone: "warn", title: `No free ${m[1] ?? ""}pigeonhole at ${m[2]}`, text: "Wait for one to be handed over." } : null;
}

// Station choice in localStorage, read through useSyncExternalStore (null on the server).
const STATION_EVENT = "tgcg-desk-station";
function subscribeStation(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(STATION_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STATION_EVENT, onChange);
  };
}
const readStation = () => window.localStorage.getItem(STATION_KEY);

export default function DeskStation({
  eventId,
  stations: initialStations,
  canCancel,
  assignedDesk,
  onDeskChange,
}: {
  eventId: string;
  stations: string[];
  canCancel: boolean;
  /**
   * Desk volunteers (0033): the desk the admin assigned, null = none yet. The server decides it;
   * this screen only shows it. Left out for admins, who choose the desk here.
   */
  assignedDesk?: string | null;
  /** Called when the admin moves this desk volunteer, or takes them off their desk. */
  onDeskChange?: (desk: string | null) => void;
}) {
  const fixed = assignedDesk !== undefined;
  const [assigned, setAssigned] = useState<string | null>(assignedDesk ?? null);
  // What the last poll said, to spot the admin's changes. undefined = no poll back yet.
  const assignedSeen = useRef<string | null | undefined>(undefined);
  const [note, setNote] = useState<Alert | null>(null);
  // An admin's choice of desk sticks to this browser (one laptop per desk).
  const saved = useSyncExternalStore(subscribeStation, readStation, () => null);
  const chosen =
    saved && initialStations.includes(saved) ? saved : initialStations.length === 1 ? initialStations[0] : null;
  const station = fixed ? assigned : chosen;
  const [board, setBoard] = useState<DeskBoard | null>(null);
  const [boardError, setBoardError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [banner, setBanner] = useState<Alert | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState<DeskLookup | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<DeskOrder | null>(null);
  const [cancelling, setCancelling] = useState<DeskOrder | null>(null);
  const readySeen = useRef<Set<string> | null>(null);
  const latest = useLatestReply();

  const stations = board?.stations.length ? board.stations : initialStations;

  function chooseStation(s: string) {
    // A poll for the old desk may still be on its way: don't let it fill the new desk's board.
    latest.drop();
    readySeen.current = null;
    setBoard(null);
    window.localStorage.setItem(STATION_KEY, s);
    window.dispatchEvent(new Event(STATION_EVENT));
  }

  async function refreshBoard() {
    const ticket = latest.begin();
    const res = await postExpo<{ board?: DeskBoard; assignedDesk?: string | null }>({ action: "desk-board", eventId, station });
    // Left before the last create / hand-over (or a station switch) and came back after it.
    if (latest.isStale(ticket)) return;
    setNow(Date.now());
    if (!res.ok || !res.board) {
      setBoardError(true);
      return;
    }
    setBoardError(false);
    if (fixed) {
      const next = res.assignedDesk ?? null;
      const before = assignedSeen.current;
      assignedSeen.current = next;
      if (before !== next) {
        // The admin moved them or took them off (not the first poll): what was on screen belonged to the old desk.
        if (before !== undefined) {
          setNote(
            next
              ? { tone: "note", title: `You're now at desk ${next}`, text: "Set by the supervisor." }
              : { tone: "warn", title: "You were taken off your desk", text: "Ask the supervisor. This screen updates by itself." }
          );
          readySeen.current = null;
          setLookup(null);
          setSelected([]);
          setPreview(null);
          setBanner(null);
        }
        setAssigned(next);
        onDeskChange?.(next);
      }
    }
    // Chime once for each order that turns Ready while the desk is watching.
    const ready = res.board.open.filter((o) => o.status === "ready").map((o) => o.id);
    if (readySeen.current && ready.some((id) => !readySeen.current!.has(id))) chime();
    readySeen.current = new Set(ready);
    setBoard(res.board);
  }
  // A desk volunteer keeps polling with no desk, to notice when the admin assigns one.
  usePoll(refreshBoard, 3000, fixed || station !== null);

  async function onScan(raw: string) {
    if (!station) return;
    const value = raw.trim();
    setBusy(true);
    if (HANDOVER_CODE.test(value)) {
      const res = await postExpo<{ order?: DeskOrder }>({ action: "order-preview", eventId, code: value });
      setBusy(false);
      if (!res.ok || !res.order) {
        setBanner(alertFrom(false, res.message ?? "No open order"));
        buzz();
        return;
      }
      setBanner(null);
      setPreview(res.order);
      return;
    }

    const res = await postExpo<{ lookup?: DeskLookup }>({ action: "desk-lookup", eventId, code: value });
    setBusy(false);
    if (!res.ok || !res.lookup) {
      setBanner(alertFrom(false, res.message ?? "Runner not found"));
      setLookup(null);
      buzz();
      return;
    }
    setLookup(res.lookup);
    setSelected(res.lookup.scanned.blocker ? [] : [res.lookup.scanned.registrationId]);
    // A runner who can't be collected now (already collected, in another order, corporate): a warning.
    const { name, blocker } = res.lookup.scanned;
    setBanner(blocker ? { tone: "warn", title: name, text: blocker } : null);
  }

  async function createOrder() {
    if (!station || selected.length === 0) return;
    setBusy(true);
    const res = await postExpo<{ code?: string; crate?: string }>({
      action: "create-order",
      eventId,
      station,
      registrationIds: selected,
    });
    setBusy(false);
    if (!res.ok) {
      // A refusal here is a warning (desk full, runner already in an order), not a wrong scan.
      const message = res.message ?? "Could not create the order";
      setBanner(noFreePigeonhole(message) ?? { ...alertFrom(false, message), tone: "warn" });
      buzz();
      return;
    }
    setBanner({ tone: "done", title: `Order ${res.code} → pigeonhole ${res.crate}`, text: "Ask the runner to wait; it turns Ready on the right." });
    setLookup(null);
    setSelected([]);
    void refreshBoard();
  }

  async function handOver(order: DeskOrder) {
    setBusy(true);
    const res = await postExpo({ action: "fulfil", eventId, code: order.code });
    setBusy(false);
    setPreview(null);
    setBanner(alertFrom(res.ok, res.message ?? (res.ok ? "Handed over" : "Could not hand over")));
    if (!res.ok) buzz();
    void refreshBoard();
  }

  if (initialStations.length === 0) {
    return (
      <Banner tone="danger" title="No pigeonholes set up for this event">
        Seed the desk pigeonholes first (kit_seed_pigeonholes in 0030), then reload this page.
      </Banner>
    );
  }

  const ready = board?.open.filter((o) => o.status === "ready") ?? [];
  const picking = board?.open.filter((o) => o.status === "picking") ?? [];

  return (
    <div className="flex flex-col gap-4">
      <ResultBanner banner={note} onDismiss={() => setNote(null)} />
      <div className="flex flex-wrap items-center gap-3">
        {fixed ? (
          station && (
            <>
              <span className="text-14 font-medium text-ink-secondary">This desk</span>
              <StatusPill tone="info">{station}</StatusPill>
              <span className="text-12 text-ink-muted">Set by the supervisor</span>
            </>
          )
        ) : (
          <>
            <span className="text-14 font-medium text-ink-secondary">This desk</span>
            <SegmentedControl
              size="md"
              ariaLabel="Desk station"
              options={stations.map((s) => ({ value: s, label: s }))}
              value={station ?? ""}
              onChange={chooseStation}
            />
          </>
        )}
        {board && station && (
          <span className="text-14 text-ink-tertiary">
            Free pigeonholes: {board.crates.free.small}/{board.crates.total.small} small · {board.crates.free.large}/
            {board.crates.total.large} large
          </span>
        )}
        {boardError && <StatusPill tone="expired">Connection problem: retrying</StatusPill>}
      </div>

      {!station ? (
        <Card>
          {fixed ? (
            <EmptyState title="No desk assigned yet">
              <p className="text-14 text-ink-tertiary">Ask the supervisor to assign you a desk. This screen updates by itself.</p>
            </EmptyState>
          ) : (
            <EmptyState title="Choose which desk this is to start." />
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left: scan + new order */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <ScanInput
                label="Scan runner pass / BIB, or a pigeonhole label to hand over"
                onScan={onScan}
                disabled={busy || preview !== null}
              />
            </Card>
            <ResultBanner banner={banner} />
            {lookup && (
              <NewOrderCard
                lookup={lookup}
                selected={selected}
                onChange={setSelected}
                busy={busy}
                onCreate={createOrder}
                onClear={() => {
                  setLookup(null);
                  setSelected([]);
                }}
              />
            )}
          </div>

          {/* Right: this desk's orders */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card title={`Ready to hand over (${ready.length})`}>
              {ready.length === 0 ? (
                <p className="text-14 text-ink-muted">Nothing ready yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {ready.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => setPreview(o)}
                        className="flex w-full items-center gap-3 rounded-8 border border-[#ABEFC6] bg-tint-green px-4 py-3 text-left hover:border-[#75E0A7]"
                      >
                        <span className="font-mono text-24 font-semibold text-on-tint-green">{o.crate}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-14 font-medium text-ink">{runnerSummary(o)}</span>
                          <span className="block text-12 text-ink-tertiary">
                            {o.code} · ready {o.readyAt ? elapsed(o.readyAt, now) : ""} ago
                          </span>
                        </span>
                        <Icon name="chevronRight" size={18} className="text-on-tint-green" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={`Being picked (${picking.length})`}>
              {picking.length === 0 ? (
                <p className="text-14 text-ink-muted">No orders being picked.</p>
              ) : (
                <ul className="divide-y divide-line-secondary">
                  {picking.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                      <span className="w-16 font-mono text-16 font-semibold text-ink">{o.crate}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-14 text-ink">{runnerSummary(o)}</span>
                        <span className="block text-12 text-ink-tertiary">
                          {o.code} · {elapsed(o.createdAt, now)}
                        </span>
                      </span>
                      <span className="flex gap-1">
                        {o.tasks.map((t) => (
                          <StatusPill key={t.kind} tone={t.status === "done" ? "active" : t.status === "accepted" ? "info" : "pending"}>
                            {KIND_LABEL[t.kind]}
                            {t.status === "done" ? " ✓" : t.status === "accepted" ? " …" : ""}
                          </StatusPill>
                        ))}
                      </span>
                      {canCancel && (
                        <Button size="sm" variant="red" onClick={() => setCancelling(o)}>
                          Cancel
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {board && board.recent.length > 0 && (
              <Card title="Recently handed over">
                <ul className="divide-y divide-line-secondary text-14">
                  {board.recent.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 py-2 text-ink-tertiary">
                      <span className="w-16 font-mono">{o.code}</span>
                      <span className="min-w-0 flex-1 truncate">{runnerSummary(o)}</span>
                      <span>{o.fulfilledAt ? `${elapsed(o.fulfilledAt, now)} ago` : ""}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      <HandoverModal
        order={preview}
        busy={busy}
        canCancel={canCancel}
        onClose={() => setPreview(null)}
        onConfirm={handOver}
        onCancelOrder={(o) => {
          setPreview(null);
          setCancelling(o);
        }}
      />
      <CancelModal
        order={cancelling}
        onClose={() => setCancelling(null)}
        onDone={(text, ok) => {
          setCancelling(null);
          setBanner(alertFrom(ok, text));
          void refreshBoard();
        }}
      />
    </div>
  );
}

function runnerSummary(o: DeskOrder) {
  if (o.runners.length === 0) return "—";
  const first = o.runners[0].name;
  return o.runners.length === 1 ? first : `${first} +${o.runners.length - 1}`;
}

function RunnerRow({ r, checked, onToggle, disabled }: { r: DeskRunner; checked: boolean; onToggle: (v: boolean) => void; disabled: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Checkbox checked={checked} onChange={onToggle} disabled={disabled || r.blocker !== null} ariaLabel={`Collect for ${r.name}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-14 font-medium text-ink">{r.name}</span>
        <span className="block text-12 text-ink-tertiary">
          {[r.category, r.tshirt ? `T-shirt ${r.tshirt}` : "No T-shirt"].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="font-mono text-16 font-semibold text-ink">{r.bib ?? "—"}</span>
      {r.blocker && <StatusPill tone="warning">{r.blocker}</StatusPill>}
    </li>
  );
}

function NewOrderCard({
  lookup,
  selected,
  onChange,
  busy,
  onCreate,
  onClear,
}: {
  lookup: DeskLookup;
  selected: string[];
  onChange: (ids: string[]) => void;
  busy: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  const all = [lookup.scanned, ...lookup.group];
  const eligible = all.filter((r) => !r.blocker).map((r) => r.registrationId);
  const toggle = (id: string) => (on: boolean) => onChange(on ? [...selected, id] : selected.filter((x) => x !== id));
  const full = selected.length >= MAX_RUNNERS;

  return (
    <Card
      title="New order"
      actions={
        <Button size="sm" onClick={onClear}>
          Clear
        </Button>
      }
    >
      <ul className="divide-y divide-line-secondary">
        <RunnerRow
          r={lookup.scanned}
          checked={selected.includes(lookup.scanned.registrationId)}
          onToggle={toggle(lookup.scanned.registrationId)}
          disabled={busy || (full && !selected.includes(lookup.scanned.registrationId))}
        />
      </ul>

      {lookup.group.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-14 font-medium text-ink-secondary">
              Same booking{lookup.bookingCode ? ` (${lookup.bookingCode})` : ""}: tick who is being collected now
            </p>
            {eligible.length > 1 && (
              <Button size="sm" onClick={() => onChange(eligible.slice(0, MAX_RUNNERS))} disabled={busy}>
                Select all{eligible.length > MAX_RUNNERS ? ` (first ${MAX_RUNNERS})` : ""}
              </Button>
            )}
          </div>
          <ul className="relative max-h-[320px] divide-y divide-line-secondary overflow-y-auto">
            {lookup.group.map((r) => (
              <RunnerRow
                key={r.registrationId}
                r={r}
                checked={selected.includes(r.registrationId)}
                onToggle={toggle(r.registrationId)}
                disabled={busy || (full && !selected.includes(r.registrationId))}
              />
            ))}
          </ul>
        </div>
      )}

      {full && <p className="mt-3 text-12 text-on-tint-orange">At most {MAX_RUNNERS} runners per order. Make a second order for the rest.</p>}

      <Button variant="dark" className="mt-4 h-12! w-full text-16!" disabled={busy || selected.length === 0} onClick={onCreate}>
        {busy ? "Creating…" : `Create order for ${selected.length} runner${selected.length === 1 ? "" : "s"}`}
      </Button>
      {selected.length > 1 && <p className="mt-2 text-12 text-ink-tertiary">Groups go in a large pigeonhole.</p>}
    </Card>
  );
}

function HandoverModal({
  order,
  busy,
  canCancel,
  onClose,
  onConfirm,
  onCancelOrder,
}: {
  order: DeskOrder | null;
  busy: boolean;
  canCancel: boolean;
  onClose: () => void;
  onConfirm: (o: DeskOrder) => void;
  onCancelOrder: (o: DeskOrder) => void;
}) {
  if (!order) return null;
  const isReady = order.status === "ready";
  return (
    <Modal
      open
      title={`Pigeonhole ${order.crate ?? "—"} · ${order.code}`}
      subtitle={isReady ? "Check the name and BIB with the runner, then hand over." : "Still being picked: not ready yet."}
      icon="handover"
      width={560}
      onClose={onClose}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {canCancel && (
            <Button variant="red" onClick={() => onCancelOrder(order)} disabled={busy} className="mr-auto">
              Cancel order
            </Button>
          )}
          <Button onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button variant="green" onClick={() => onConfirm(order)} disabled={busy || !isReady}>
            {busy ? "Handing over…" : `Hand over ${order.runners.length} kit${order.runners.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      }
    >
      <ul className="divide-y divide-line-secondary">
        {order.runners.map((r) => (
          <li key={`${r.name}-${r.bib}`} className="flex items-center gap-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-20 font-semibold text-ink">{r.name}</span>
              <span className="block text-14 text-ink-tertiary">
                {[r.category, r.tshirt ? `T-shirt ${r.tshirt}` : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="font-mono text-24 font-semibold text-ink">{r.bib ?? "—"}</span>
          </li>
        ))}
      </ul>
      {!isReady && (
        <div className="mt-3 flex flex-wrap gap-1">
          {order.tasks.map((t) => (
            <StatusPill key={t.kind} tone={t.status === "done" ? "active" : "pending"}>
              {KIND_LABEL[t.kind]} {t.status === "done" ? "in pigeonhole" : "being picked"}
            </StatusPill>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function CancelModal({
  order,
  onClose,
  onDone,
}: {
  order: Pick<DeskOrder, "id" | "code"> | null;
  onClose: () => void;
  onDone: (text: string, ok: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!order) return null;

  async function submit() {
    if (!order) return;
    setBusy(true);
    setError(null);
    const res = await postExpo({ action: "cancel-order", orderId: order.id, reason });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "Could not cancel");
      return;
    }
    setReason("");
    onDone(res.message ?? `Cancelled ${order.code}`, true);
  }

  return (
    <Modal
      open
      title={`Cancel ${order.code}?`}
      subtitle="Frees the pigeonhole and stops any picking. Items already in the pigeonhole go back to their bins."
      icon="warning"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Keep order
          </Button>
          <Button variant="red" onClick={submit} disabled={busy || reason.trim().length < 3}>
            {busy ? "Cancelling…" : "Cancel order"}
          </Button>
        </div>
      }
    >
      <TextField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. wrong runner ticked" />
      {error && (
        <div className="mt-3">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}
    </Modal>
  );
}
