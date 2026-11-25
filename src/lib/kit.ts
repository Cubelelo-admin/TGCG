import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Flow B kit distribution (supabase/migrations/0025_kit_flow_b.sql).
 * Scan codes a picker uses: a BIB number, "TS-<size>" for a T-shirt bin,
 * "PACK" for the accessory-pack bin.
 */

export type KitBoxStatus = "open" | "ready" | "staged" | "handed_over" | "collected";
export type KitChannel = "expo" | "corporate";

export interface KitBoxSummary {
  code: string;
  kind: "expo_bag" | "group_box";
  status: KitBoxStatus;
  kitGroup: string | null;
  boxNo: number | null;
  shelfAddress: string | null;
  scanned: number;
  total: number;
  /** Items still to scan, for the picker's checklist. */
  missingBibs: { bib: string; name: string }[];
  missingShirts: Record<string, number>;
  missingPacks: number;
  runnerName: string | null;
}

type ItemRow = {
  kind: "bib" | "tshirt" | "pack";
  size: string | null;
  scanned_at: string | null;
  registrations: { full_name: string; bib_number: string | null } | null;
};

export async function loadBox(code: string): Promise<KitBoxSummary | null> {
  const supabase = createServiceClient();
  // One round trip: the box with its items embedded (a box holds ≤ ~60 items,
  // far under the 1000-row response cap).
  const { data: box } = await supabase
    .from("kit_boxes")
    .select(
      "code, kind, status, kit_group, box_no, shelf_address, registrations(full_name), kit_items(kind, size, scanned_at, registrations(full_name, bib_number))"
    )
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!box) return null;

  const rows = (box.kit_items ?? []) as unknown as ItemRow[];
  const missingShirts: Record<string, number> = {};
  let missingPacks = 0;
  const missingBibs: { bib: string; name: string }[] = [];
  for (const i of rows) {
    if (i.scanned_at) continue;
    if (i.kind === "tshirt") missingShirts[i.size ?? "?"] = (missingShirts[i.size ?? "?"] ?? 0) + 1;
    else if (i.kind === "pack") missingPacks += 1;
    else missingBibs.push({ bib: i.registrations?.bib_number ?? "?", name: i.registrations?.full_name ?? "" });
  }

  const reg = box.registrations as unknown as { full_name: string } | null;
  return {
    code: box.code,
    kind: box.kind,
    status: box.status,
    kitGroup: box.kit_group,
    boxNo: box.box_no,
    shelfAddress: box.shelf_address,
    scanned: rows.filter((i) => i.scanned_at).length,
    total: rows.length,
    missingBibs,
    missingShirts,
    missingPacks,
    runnerName: reg?.full_name ?? null,
  };
}

export interface KitGroupBoxes {
  group: string;
  boxes: { code: string; boxNo: number | null; status: KitBoxStatus }[];
}

export async function loadGroupBoxes(eventId: string): Promise<KitGroupBoxes[]> {
  const supabase = createServiceClient();
  const out = new Map<string, KitGroupBoxes>();
  // Paged: 4,600 runners / 20 per box is far below the cap, but never assume.
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("kit_boxes")
      .select("code, box_no, status, kit_group")
      .eq("event_id", eventId)
      .eq("kind", "group_box")
      .order("kit_group")
      .order("box_no")
      .range(from, from + 999);
    for (const b of data ?? []) {
      const g = out.get(b.kit_group) ?? { group: b.kit_group as string, boxes: [] };
      g.boxes.push({ code: b.code, boxNo: b.box_no, status: b.status });
      out.set(b.kit_group, g);
    }
    if (!data || data.length < 1000) break;
  }
  return [...out.values()];
}

export interface KitRunnerLookup {
  registrationId: string;
  name: string;
  registrationCode: string | null;
  bib: string | null;
  category: string | null;
  tshirt: string | null;
  idLast4: string | null;
  channel: KitChannel;
  kitGroup: string | null;
  bagCode: string | null;
  bagStatus: KitBoxStatus | null;
  shelfAddress: string | null;
}

/** Runner by pass (registration code) or BIB number, within an event. */
export async function lookupRunner(eventId: string, scan: string): Promise<KitRunnerLookup | null> {
  const supabase = createServiceClient();
  const term = scan.trim();
  if (!term) return null;

  const cols =
    "id, full_name, registration_code, bib_number, tshirt_size, aadhar_number, kit_channel, kit_group, ticket_categories(name), kit_boxes(code, status, shelf_address, kind)";
  const byCode = await supabase
    .from("registrations")
    .select(cols)
    .eq("event_id", eventId)
    .eq("payment_status", "paid")
    .ilike("registration_code", term)
    .maybeSingle();
  const row =
    byCode.data ??
    (
      await supabase
        .from("registrations")
        .select(cols)
        .eq("event_id", eventId)
        .eq("payment_status", "paid")
        .eq("bib_number", term)
        .neq("bib_number", "SUPERHERO")
        .maybeSingle()
    ).data;
  if (!row) return null;

  const boxes = (row.kit_boxes ?? []) as unknown as { code: string; status: KitBoxStatus; shelf_address: string | null; kind: string }[];
  const bag = boxes.find((b) => b.kind === "expo_bag") ?? null;
  const cat = row.ticket_categories as unknown as { name: string } | null;
  const aadhar = (row.aadhar_number as string | null)?.replace(/\D/g, "") ?? "";

  return {
    registrationId: row.id,
    name: row.full_name,
    registrationCode: row.registration_code,
    bib: row.bib_number,
    category: cat?.name ?? null,
    tshirt: row.tshirt_size,
    idLast4: aadhar.length >= 4 ? aadhar.slice(-4) : null,
    channel: row.kit_channel,
    kitGroup: row.kit_group,
    bagCode: bag?.code ?? null,
    bagStatus: bag?.status ?? null,
    shelfAddress: bag?.shelf_address ?? null,
  };
}

export async function getKitOverview(eventId: string) {
  const supabase = createServiceClient();
  const [status, pocs, channels] = await Promise.all([
    supabase.rpc("kit_status_counts", { p_event_id: eventId }),
    supabase.rpc("kit_poc_summary", { p_event_id: eventId }),
    supabase.rpc("kit_channel_counts", { p_event_id: eventId }),
  ]);
  for (const r of [status, pocs, channels]) if (r.error) console.error("kit overview rpc failed", r.error);

  return {
    status: (status.data ?? []) as { kind: string; status: string; box_count: number }[],
    pocs: (pocs.data ?? []) as { poc_name: string; paid_count: number; corporate_count: number; boxed_count: number }[],
    channels: (channels.data ?? []) as { kit_channel: KitChannel; paid_count: number; boxed_count: number }[],
  };
}

/** Size bins printed for the pick floor. */
export const KIT_BIN_CODES = ["TS-XS", "TS-S", "TS-M", "TS-L", "TS-XL", "TS-XXL", "TS-XXXL", "PACK"] as const;
