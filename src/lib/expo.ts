import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/*
 * Read side of the expo on-demand flow (0030, docs/expo-on-demand-design.md). Writes go
 * through the 0030 RPCs. What each role may see is decided HERE, not in the UI:
 *  - desk:   runner name, BIB, category, T-shirt size, booking group. No phone/email/ID.
 *  - picker: item kinds, sizes, BIB numbers, bin and crate labels. No names at all, and a
 *            line's size/BIB only once its source bin has been scanned (opened_at set).
 */

export type ExpoKind = "bib" | "tshirt" | "pack";
export const KIND_LABEL: Record<ExpoKind, string> = { bib: "BIB", tshirt: "T-shirt", pack: "Accessory pack" };

/** Calls the dispatcher (expired offers → queue, queued tasks → free pickers). Every poll does this. */
export async function dispatch(eventId: string) {
  const { error } = await createServiceClient().rpc("kit_dispatch", { p_event_id: eventId });
  if (error) console.error("kit_dispatch failed", error);
}

/* ------------------------------------------------------------------ desk */

export interface DeskRunner {
  registrationId: string;
  name: string;
  registrationCode: string | null;
  bib: string | null;
  category: string | null;
  tshirt: string | null;
  /** Why this runner can't go into a new order (null = can). Mirrors kit_order_blocker. */
  blocker: string | null;
}

export interface DeskLookup {
  /** The runner whose pass/BIB was scanned. */
  scanned: DeskRunner;
  /** Other paid runners in the same booking, scanned runner excluded. */
  group: DeskRunner[];
  bookingCode: string | null;
}

type RunnerRow = {
  id: string;
  full_name: string;
  registration_code: string | null;
  bib_number: string | null;
  tshirt_size: string | null;
  kit_channel: string | null;
  group_id: string | null;
  ticket_categories: { name: string } | null;
  registration_groups: { booking_code: string | null } | null;
};
const RUNNER_COLS =
  "id, full_name, registration_code, bib_number, tshirt_size, kit_channel, group_id, ticket_categories(name), registration_groups(booking_code)";

/** Pass (registration code) or BIB → that runner plus the rest of their paid booking. */
export async function deskLookup(eventId: string, scan: string): Promise<DeskLookup | null> {
  const supabase = createServiceClient();
  const term = scan.trim();
  if (!term) return null;

  const base = () => supabase.from("registrations").select(RUNNER_COLS).eq("event_id", eventId).eq("payment_status", "paid");
  const byCode = await base().ilike("registration_code", term).maybeSingle();
  const row = (byCode.data ??
    (await base().eq("bib_number", term).neq("bib_number", "SUPERHERO").maybeSingle()).data) as RunnerRow | null;
  if (!row) return null;

  let members: RunnerRow[] = [];
  if (row.group_id) {
    const { data } = await base().eq("group_id", row.group_id).neq("id", row.id).order("full_name").limit(60);
    members = (data ?? []) as unknown as RunnerRow[];
  }

  const blockers = await orderBlockers([row, ...members]);
  const toRunner = (r: RunnerRow): DeskRunner => ({
    registrationId: r.id,
    name: r.full_name,
    registrationCode: r.registration_code,
    bib: r.bib_number,
    category: r.ticket_categories?.name ?? null,
    tshirt: r.tshirt_size,
    blocker: blockers.get(r.id) ?? null,
  });
  return {
    scanned: toRunner(row),
    group: members.map(toRunner),
    bookingCode: row.registration_groups?.booking_code ?? null,
  };
}

/** Same rules as kit_order_blocker (paid is already filtered), in two queries for a whole booking. */
async function orderBlockers(rows: RunnerRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const r of rows) {
    if (r.kit_channel === "corporate") out.set(r.id, "Corporate: kit goes via the company rep");
  }
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return out;

  const supabase = createServiceClient();
  const [lines, bags] = await Promise.all([
    supabase
      .from("kit_order_lines")
      .select("registration_id, kit_orders!kit_order_lines_order_id_fkey!inner(code, status)")
      .in("registration_id", ids)
      .neq("status", "cancelled"),
    supabase
      .from("kit_boxes")
      .select("registration_id")
      .in("registration_id", ids)
      .eq("kind", "expo_bag")
      .eq("status", "collected"),
  ]);
  for (const b of (bags.data ?? []) as { registration_id: string }[]) {
    if (!out.has(b.registration_id)) out.set(b.registration_id, "Kit already collected");
  }
  for (const l of (lines.data ?? []) as unknown as { registration_id: string; kit_orders: { code: string; status: string } }[]) {
    if (out.has(l.registration_id)) continue;
    if (l.kit_orders.status === "fulfilled") out.set(l.registration_id, "Kit already collected");
    else if (l.kit_orders.status === "picking" || l.kit_orders.status === "ready") {
      out.set(l.registration_id, `Already in order ${l.kit_orders.code}`);
    }
  }
  return out;
}

export type OrderStatus = "picking" | "ready" | "fulfilled" | "cancelled";
export type TaskStatus = "queued" | "offered" | "accepted" | "done" | "cancelled";

export interface DeskOrder {
  id: string;
  code: string;
  status: OrderStatus;
  crate: string | null;
  createdAt: string;
  readyAt: string | null;
  fulfilledAt: string | null;
  runners: { name: string; bib: string | null; tshirt: string | null; category: string | null }[];
  tasks: { kind: ExpoKind; status: TaskStatus }[];
}

export interface DeskBoard {
  stations: string[];
  /** Picking + ready at this station, oldest first. */
  open: DeskOrder[];
  /** Last few handed over at this station, newest first. */
  recent: DeskOrder[];
  crates: { free: { small: number; large: number }; total: { small: number; large: number } };
}

type OrderRow = {
  id: string;
  code: string;
  status: OrderStatus;
  created_at: string;
  ready_at: string | null;
  fulfilled_at: string | null;
  kit_pigeonholes: { label: string } | null;
  kit_tasks: { kind: ExpoKind; status: TaskStatus }[];
  kit_order_lines: {
    registration_id: string;
    status: string;
    registrations: { full_name: string; bib_number: string | null; tshirt_size: string | null; ticket_categories: { name: string } | null } | null;
  }[];
};
const ORDER_COLS =
  "id, code, status, created_at, ready_at, fulfilled_at, kit_pigeonholes!kit_orders_pigeonhole_id_fkey(label), kit_tasks!kit_tasks_order_id_fkey(kind, status), kit_order_lines!kit_order_lines_order_id_fkey(registration_id, status, registrations(full_name, bib_number, tshirt_size, ticket_categories(name)))";

function toDeskOrder(o: OrderRow): DeskOrder {
  const seen = new Set<string>();
  const runners: DeskOrder["runners"] = [];
  for (const l of o.kit_order_lines) {
    if (seen.has(l.registration_id) || !l.registrations) continue;
    seen.add(l.registration_id);
    runners.push({
      name: l.registrations.full_name,
      bib: l.registrations.bib_number,
      tshirt: l.registrations.tshirt_size,
      category: l.registrations.ticket_categories?.name ?? null,
    });
  }
  const kindOrder: ExpoKind[] = ["bib", "tshirt", "pack"];
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    crate: o.kit_pigeonholes?.label ?? null,
    createdAt: o.created_at,
    readyAt: o.ready_at,
    fulfilledAt: o.fulfilled_at,
    runners: runners.sort((a, b) => a.name.localeCompare(b.name)),
    tasks: [...o.kit_tasks].sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind)),
  };
}

export async function listStations(eventId: string): Promise<string[]> {
  const { data, error } = await createServiceClient().from("kit_pigeonholes").select("station").eq("event_id", eventId);
  if (error) console.error("listStations failed", error);
  return [...new Set(((data ?? []) as { station: string }[]).map((r) => r.station))].sort();
}

export async function loadDeskBoard(eventId: string, station: string | null): Promise<DeskBoard> {
  const supabase = createServiceClient();
  const stations = await listStations(eventId);
  const empty = { small: 0, large: 0 };
  if (!station || !stations.includes(station)) {
    return { stations, open: [], recent: [], crates: { free: { ...empty }, total: { ...empty } } };
  }

  const [open, recent, holes] = await Promise.all([
    supabase
      .from("kit_orders")
      .select(ORDER_COLS)
      .eq("event_id", eventId)
      .eq("station", station)
      .in("status", ["picking", "ready"])
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("kit_orders")
      .select(ORDER_COLS)
      .eq("event_id", eventId)
      .eq("station", station)
      .eq("status", "fulfilled")
      .order("fulfilled_at", { ascending: false })
      .limit(5),
    supabase.from("kit_pigeonholes").select("size, status").eq("event_id", eventId).eq("station", station),
  ]);
  for (const r of [open, recent, holes]) if (r.error) console.error("loadDeskBoard failed", r.error);

  const crates = { free: { ...empty }, total: { ...empty } };
  for (const h of (holes.data ?? []) as { size: "small" | "large"; status: string }[]) {
    crates.total[h.size] += 1;
    if (h.status === "free") crates.free[h.size] += 1;
  }
  return {
    stations,
    open: ((open.data ?? []) as unknown as OrderRow[]).map(toDeskOrder),
    recent: ((recent.data ?? []) as unknown as OrderRow[]).map(toDeskOrder),
    crates,
  };
}

/** Open order by code (O-0001) or crate label (D1-S1), for the handover confirmation. */
export async function findOpenOrder(eventId: string, code: string): Promise<DeskOrder | null> {
  const supabase = createServiceClient();
  const term = code.trim().toUpperCase();
  if (!term) return null;

  const { data: hole } = await supabase
    .from("kit_pigeonholes")
    .select("order_id")
    .eq("event_id", eventId)
    .eq("label", term)
    .maybeSingle();
  let query = supabase.from("kit_orders").select(ORDER_COLS).eq("event_id", eventId).in("status", ["picking", "ready"]);
  query = hole?.order_id ? query.eq("id", hole.order_id) : query.eq("code", term);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) console.error("findOpenOrder failed", error);
  return data ? toDeskOrder(data as unknown as OrderRow) : null;
}

/* ---------------------------------------------------------------- picker */

export interface PickerLine {
  lineId: string;
  /** Only once the bin has been scanned. */
  size: string | null;
  bib: string | null;
  picked: boolean;
}

export interface PickerBin {
  code: string;
  count: number;
  picked: number;
  /** Bin scanned: its lines show size/BIB. */
  opened: boolean;
  /** An open "bin empty" alert (0031) exists for this bin: restock is on the way. */
  empty: boolean;
  lines: PickerLine[];
}

export interface PickerTask {
  id: string;
  kind: ExpoKind;
  status: "offered" | "accepted";
  offerExpiresAt: string | null;
  orderCode: string;
  crate: string | null;
  bins: PickerBin[];
  allPicked: boolean;
}

export interface PickerState {
  /** null = never toggled Active (no kit_pickers row yet). */
  picker: { active: boolean; specialties: ExpoKind[] } | null;
  task: PickerTask | null;
  /** Tasks waiting for any picker (shown so an idle picker knows the floor is quiet). */
  queued: number;
}

export async function loadPickerState(eventId: string, email: string): Promise<PickerState> {
  const supabase = createServiceClient();
  const [{ data: picker, error }, queued] = await Promise.all([
    supabase
      .from("kit_pickers")
      .select("active, specialties, current_task_id")
      .eq("event_id", eventId)
      .eq("email", email.toLowerCase())
      .maybeSingle(),
    supabase
      .from("kit_tasks")
      .select("id, kit_orders!kit_tasks_order_id_fkey!inner(event_id, status)", { count: "exact", head: true })
      .eq("status", "queued")
      .eq("kit_orders.event_id", eventId)
      .eq("kit_orders.status", "picking"),
  ]);
  if (error) console.error("loadPickerState failed", error);
  if (!picker) return { picker: null, task: null, queued: queued.count ?? 0 };

  const state: PickerState = {
    picker: { active: picker.active, specialties: picker.specialties as ExpoKind[] },
    task: null,
    queued: queued.count ?? 0,
  };
  if (!picker.current_task_id) return state;

  const { data: task } = await supabase
    .from("kit_tasks")
    .select(
      "id, kind, status, offer_expires_at, kit_orders!kit_tasks_order_id_fkey!inner(code, kit_pigeonholes!kit_orders_pigeonhole_id_fkey(label)), kit_order_lines!kit_order_lines_task_id_fkey(id, bin_code, size, status, opened_at, picked_at, registrations(bib_number))"
    )
    .eq("id", picker.current_task_id)
    .maybeSingle();
  if (!task || (task.status !== "offered" && task.status !== "accepted")) return state;

  type LineRow = {
    id: string;
    bin_code: string;
    size: string | null;
    status: string;
    opened_at: string | null;
    picked_at: string | null;
    registrations: { bib_number: string | null } | null;
  };
  const order = task.kit_orders as unknown as { code: string; kit_pigeonholes: { label: string } | null };
  const bins = new Map<string, PickerBin>();
  for (const l of (task.kit_order_lines ?? []) as unknown as LineRow[]) {
    if (l.status !== "pending") continue;
    const bin = bins.get(l.bin_code) ?? { code: l.bin_code, count: 0, picked: 0, opened: false, empty: false, lines: [] };
    const opened = l.opened_at !== null;
    bin.count += 1;
    if (l.picked_at) bin.picked += 1;
    bin.opened ||= opened;
    bin.lines.push({
      lineId: l.id,
      size: opened ? l.size : null,
      bib: opened && task.kind === "bib" ? (l.registrations?.bib_number ?? null) : null,
      picked: l.picked_at !== null,
    });
    bins.set(l.bin_code, bin);
  }
  const binList = [...bins.values()].sort((a, b) => a.code.localeCompare(b.code));
  for (const b of binList) b.lines.sort((x, y) => (x.bib ?? "").localeCompare(y.bib ?? ""));

  if (task.status === "accepted" && binList.length > 0) {
    const { data: alerts } = await supabase
      .from("kit_bin_alerts")
      .select("bin_code")
      .eq("event_id", eventId)
      .eq("status", "open")
      .in("bin_code", binList.map((b) => b.code));
    const open = new Set((alerts ?? []).map((a) => a.bin_code as string));
    for (const b of binList) b.empty = open.has(b.code);
  }

  state.task = {
    id: task.id,
    kind: task.kind as ExpoKind,
    status: task.status,
    offerExpiresAt: task.offer_expires_at,
    orderCode: order.code,
    // The crate is only needed once the task is accepted.
    crate: task.status === "accepted" ? (order.kit_pigeonholes?.label ?? null) : null,
    bins: task.status === "accepted" ? binList : binList.map((b) => ({ ...b, lines: [] })),
    allPicked: binList.every((b) => b.picked === b.count),
  };
  return state;
}

/* ---------------------------------------------------------------- restock */

export interface BinAlert {
  id: string;
  bin: string;
  raisedAt: string;
  /** How many times pickers flagged it while open. */
  reports: number;
  resolvedAt: string | null;
}

export interface RestockBoard {
  /** Oldest first: the bin that has waited longest is refilled first. */
  open: BinAlert[];
  /** The last few refills, newest first. */
  recent: BinAlert[];
}

/** Bins pickers flagged empty (0031). No runner data: bin codes and times only. */
export async function loadRestockBoard(eventId: string): Promise<RestockBoard> {
  const supabase = createServiceClient();
  const cols = "id, bin_code, raised_at, reports, resolved_at";
  const [open, recent] = await Promise.all([
    supabase.from("kit_bin_alerts").select(cols).eq("event_id", eventId).eq("status", "open").order("raised_at").limit(100),
    supabase
      .from("kit_bin_alerts")
      .select(cols)
      .eq("event_id", eventId)
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .limit(8),
  ]);
  if (open.error) console.error("loadRestockBoard failed", open.error);
  type Row = { id: string; bin_code: string; raised_at: string; reports: number; resolved_at: string | null };
  const map = (r: Row): BinAlert => ({ id: r.id, bin: r.bin_code, raisedAt: r.raised_at, reports: r.reports, resolvedAt: r.resolved_at });
  return { open: ((open.data ?? []) as Row[]).map(map), recent: ((recent.data ?? []) as Row[]).map(map) };
}

/* ------------------------------------------------------------------ floor */

export interface FloorTask {
  id: string;
  kind: ExpoKind;
  status: TaskStatus;
  queuedAt: string;
  offeredAt: string | null;
  offerExpiresAt: string | null;
  acceptedAt: string | null;
  pickerId: string | null;
}

export interface FloorOrder {
  id: string;
  code: string;
  station: string;
  status: "picking" | "ready";
  crate: string | null;
  createdAt: string;
  readyAt: string | null;
  runners: number;
  tasks: FloorTask[];
}

export interface FloorPicker {
  id: string;
  name: string;
  active: boolean;
  specialties: ExpoKind[];
  freeSince: string;
  /** The task they hold (offered or accepted), with its order code. */
  task: (FloorTask & { orderCode: string }) | null;
}

export interface FloorAlert extends BinAlert {
  /** Picker name (or email) who first flagged it. */
  raisedBy: string;
  orderCode: string | null;
}

export interface FloorBoard {
  /** Picking + ready, all desks, oldest first. */
  orders: FloorOrder[];
  pickers: FloorPicker[];
  crates: { station: string; small: { free: number; total: number }; large: { free: number; total: number } }[];
  alerts: FloorAlert[];
  handedOver: { total: number; lastHour: number };
  /** Average minutes over the last 20 handovers (null when there are none). */
  avgMinutes: { toReady: number | null; toHandover: number | null };
}

/** Supervisor view (admins only): every open order, picker, crate and empty bin. */
export async function loadFloorBoard(eventId: string): Promise<FloorBoard> {
  const supabase = createServiceClient();
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const fulfilled = () =>
    supabase.from("kit_orders").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "fulfilled");

  const [orders, pickers, holes, total, lastHour, recent, alerts] = await Promise.all([
    supabase
      .from("kit_orders")
      .select(
        "id, code, station, status, created_at, ready_at, kit_pigeonholes!kit_orders_pigeonhole_id_fkey(label), kit_tasks!kit_tasks_order_id_fkey(id, kind, status, queued_at, offered_at, offer_expires_at, accepted_at, picker_id), kit_order_lines!kit_order_lines_order_id_fkey(registration_id, status)"
      )
      .eq("event_id", eventId)
      .in("status", ["picking", "ready"])
      .order("created_at", { ascending: true })
      .limit(300),
    supabase
      .from("kit_pickers")
      .select("id, email, name, active, specialties, current_task_id, free_since")
      .eq("event_id", eventId)
      .order("email"),
    supabase.from("kit_pigeonholes").select("station, size, status").eq("event_id", eventId),
    fulfilled(),
    fulfilled().gte("fulfilled_at", hourAgo),
    supabase
      .from("kit_orders")
      .select("created_at, ready_at, fulfilled_at")
      .eq("event_id", eventId)
      .eq("status", "fulfilled")
      .order("fulfilled_at", { ascending: false })
      .limit(20),
    supabase
      .from("kit_bin_alerts")
      .select("id, bin_code, raised_at, raised_by, reports, resolved_at, task_id")
      .eq("event_id", eventId)
      .eq("status", "open")
      .order("raised_at")
      .limit(100),
  ]);
  for (const r of [orders, pickers, holes, total, lastHour, recent, alerts]) {
    if (r.error) console.error("loadFloorBoard failed", r.error);
  }

  type Row = {
    id: string;
    code: string;
    station: string;
    status: "picking" | "ready";
    created_at: string;
    ready_at: string | null;
    kit_pigeonholes: { label: string } | null;
    kit_tasks: {
      id: string;
      kind: ExpoKind;
      status: TaskStatus;
      queued_at: string;
      offered_at: string | null;
      offer_expires_at: string | null;
      accepted_at: string | null;
      picker_id: string | null;
    }[];
    kit_order_lines: { registration_id: string; status: string }[];
  };
  const kindOrder: ExpoKind[] = ["bib", "tshirt", "pack"];
  const orderList: FloorOrder[] = ((orders.data ?? []) as unknown as Row[]).map((o) => ({
    id: o.id,
    code: o.code,
    station: o.station,
    status: o.status,
    crate: o.kit_pigeonholes?.label ?? null,
    createdAt: o.created_at,
    readyAt: o.ready_at,
    runners: new Set(o.kit_order_lines.filter((l) => l.status !== "cancelled").map((l) => l.registration_id)).size,
    tasks: o.kit_tasks
      .filter((t) => t.status !== "cancelled")
      .sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind))
      .map((t) => ({
        id: t.id,
        kind: t.kind,
        status: t.status,
        queuedAt: t.queued_at,
        offeredAt: t.offered_at,
        offerExpiresAt: t.offer_expires_at,
        acceptedAt: t.accepted_at,
        pickerId: t.picker_id,
      })),
  }));

  const taskById = new Map<string, FloorTask & { orderCode: string }>();
  for (const o of orderList) for (const t of o.tasks) taskById.set(t.id, { ...t, orderCode: o.code });

  type PickerRow = {
    id: string;
    email: string;
    name: string | null;
    active: boolean;
    specialties: ExpoKind[];
    current_task_id: string | null;
    free_since: string;
  };
  const pickerRows = (pickers.data ?? []) as PickerRow[];
  const nameByEmail = new Map(pickerRows.map((p) => [p.email, p.name?.trim() || p.email]));
  const pickerList: FloorPicker[] = pickerRows.map((p) => {
    const task = p.current_task_id ? (taskById.get(p.current_task_id) ?? null) : null;
    return {
      id: p.id,
      name: nameByEmail.get(p.email) ?? p.email,
      active: p.active,
      specialties: p.specialties,
      freeSince: p.free_since,
      task: task && (task.status === "offered" || task.status === "accepted") ? task : null,
    };
  });
  // Busy first, then free, then inactive.
  const rank = (p: FloorPicker) => (p.task ? 0 : p.active ? 1 : 2);
  pickerList.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  const crateMap = new Map<string, FloorBoard["crates"][number]>();
  for (const h of (holes.data ?? []) as { station: string; size: "small" | "large"; status: string }[]) {
    const c = crateMap.get(h.station) ?? { station: h.station, small: { free: 0, total: 0 }, large: { free: 0, total: 0 } };
    c[h.size].total += 1;
    if (h.status === "free") c[h.size].free += 1;
    crateMap.set(h.station, c);
  }

  const mins = (from: string, to: string | null) => (to ? (Date.parse(to) - Date.parse(from)) / 60_000 : null);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null && x >= 0);
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
  };
  const recentRows = (recent.data ?? []) as { created_at: string; ready_at: string | null; fulfilled_at: string | null }[];

  type AlertRow = {
    id: string;
    bin_code: string;
    raised_at: string;
    raised_by: string;
    reports: number;
    resolved_at: string | null;
    task_id: string | null;
  };
  return {
    orders: orderList,
    pickers: pickerList,
    crates: [...crateMap.values()].sort((a, b) => a.station.localeCompare(b.station)),
    // Before 0031 the alerts table doesn't exist: the rest of the board still works.
    alerts: ((alerts.error ? [] : (alerts.data ?? [])) as AlertRow[]).map((a) => ({
      id: a.id,
      bin: a.bin_code,
      raisedAt: a.raised_at,
      raisedBy: nameByEmail.get(a.raised_by) ?? a.raised_by,
      reports: a.reports,
      resolvedAt: a.resolved_at,
      orderCode: a.task_id ? (taskById.get(a.task_id)?.orderCode ?? null) : null,
    })),
    handedOver: { total: total.count ?? 0, lastHour: lastHour.count ?? 0 },
    avgMinutes: {
      toReady: avg(recentRows.map((r) => mins(r.created_at, r.ready_at))),
      toHandover: avg(recentRows.map((r) => mins(r.created_at, r.fulfilled_at))),
    },
  };
}

/* ---------------------------------------------------------------- labels */

/**
 * The BIB file a BIB lives in. MUST match kit_bib_bin (0030): files of 100 numbers per
 * distance prefix, e.g. prefix "42", BIB 42137 → BF-42101-42200. Non-numeric BIBs and
 * categories without a prefix go to BF-MISC.
 */
export function bibBinCode(prefix: string | null, bib: string | null): string {
  if (!bib || bib === "SUPERHERO" || !prefix || !/^\d+$/.test(bib)) return "BF-MISC";
  const digits = 5 - prefix.length;
  const seq = parseInt(bib.slice(prefix.length), 10);
  const file = Math.floor((seq - 1) / 100);
  const pad = (n: number) => String(n).padStart(digits, "0");
  return `BF-${prefix}${pad(file * 100 + 1)}-${prefix}${pad((file + 1) * 100)}`;
}

export interface BibFileLabel {
  code: string;
  category: string | null;
  /** Expo runners whose BIB is in this file (corporate BIBs travel in group boxes). */
  count: number;
}

/** One label per BIB file that holds at least one paid expo (non-corporate) runner's BIB. */
export async function loadBibFileLabels(eventId: string): Promise<BibFileLabel[]> {
  const supabase = createServiceClient();
  type Row = { bib_number: string | null; ticket_categories: { name: string; bib_prefix: string | null } | null };
  const rows: Row[] = [];
  // Paged: the runner list is over PostgREST's 1000-row cap.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("registrations")
      .select("bib_number, ticket_categories(name, bib_prefix)")
      .eq("event_id", eventId)
      .eq("payment_status", "paid")
      .not("bib_number", "is", null)
      .or("kit_channel.is.null,kit_channel.neq.corporate")
      .order("id")
      .range(from, from + 999);
    if (error) console.error("loadBibFileLabels failed", error);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const files = new Map<string, BibFileLabel & { names: Set<string> }>();
  for (const r of rows) {
    if (r.bib_number === "SUPERHERO") continue; // child runners get no BIB line
    const code = bibBinCode(r.ticket_categories?.bib_prefix ?? null, r.bib_number);
    const f = files.get(code) ?? { code, category: null, count: 0, names: new Set<string>() };
    f.count += 1;
    if (r.ticket_categories?.name) f.names.add(r.ticket_categories.name);
    files.set(code, f);
  }
  // Categories can share a prefix (competitive / non-competitive of one distance), so one file
  // can hold both: name the words they share ("21 KM Half Marathon"), not whichever came first.
  for (const f of files.values()) {
    const names = [...f.names];
    if (f.code === "BF-MISC" || names.length === 0) continue;
    const words = names.map((n) => n.split(/\s+/));
    const shared: string[] = [];
    for (let i = 0; words.every((w) => i < w.length && w[i] === words[0][i]); i++) shared.push(words[0][i]);
    const common = shared.join(" ").replace(/[\s-]+$/, "");
    f.category = names.length === 1 ? names[0] : common || `${names.length} categories`;
  }
  // BF-MISC last; the rest in code order (prefix, then range).
  return [...files.values()].map((f): BibFileLabel => ({ code: f.code, category: f.category, count: f.count })).sort((a, b) =>
    a.code === "BF-MISC" ? 1 : b.code === "BF-MISC" ? -1 : a.code.localeCompare(b.code, "en", { numeric: true })
  );
}

export interface CrateLabel {
  label: string;
  station: string;
  size: "small" | "large";
}

export async function loadCrateLabels(eventId: string): Promise<CrateLabel[]> {
  const { data, error } = await createServiceClient()
    .from("kit_pigeonholes")
    .select("label, station, size")
    .eq("event_id", eventId);
  if (error) console.error("loadCrateLabels failed", error);
  return ((data ?? []) as CrateLabel[]).sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
}
