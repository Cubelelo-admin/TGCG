import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import { listStations, type ExpoKind } from "@/lib/expo";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/*
 * Volunteers on admin_allowlist (desk | picker | handover | restock, 0031) and what the admin assigns
 * them (0033): a desk volunteer's desk, a picker's items. Full admins only. Admin rows are never
 * created, changed or removed here, so nobody can lock an organiser out from the UI; promoting
 * someone to admin stays a deliberate SQL change.
 *
 * `set` keeps a desk only on a desk row and items only on a picker row: a role change clears the
 * other. A desk or items left out of the request keep their value while the role stays the same.
 */

const ITEMS: readonly ExpoKind[] = ["bib", "tshirt", "pack"];
const email = z.string().trim().toLowerCase().email("Enter a valid email").max(200);
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    email,
    role: z.enum(["desk", "picker", "handover", "restock"]),
    desk: z.string().trim().min(1).max(10).nullable().optional(),
    items: z.array(z.enum(["bib", "tshirt", "pack"])).max(3).optional(),
  }),
  z.object({ action: z.literal("remove"), email }),
]);

type Existing = { role: string; desk: string | null; picker_items: string[] | null };
type Service = ReturnType<typeof createServiceClient>;

/** Brings a picker's kit_pickers rows in line with their items (0033). No items = paused. */
async function syncPicker(supabase: Service, address: string, items: ExpoKind[]): Promise<boolean> {
  const { error } = await supabase.rpc("kit_picker_items_changed", { p_email: address, p_items: items });
  if (error) console.error("kit_picker_items_changed failed", error);
  return !error;
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const body = parsed.data;
  const supabase = createServiceClient();

  const { data, error: readError } = await supabase
    .from("admin_allowlist")
    .select("role, desk, picker_items")
    .eq("email", body.email)
    .maybeSingle();
  if (readError) {
    console.error("volunteers read failed", readError);
    return NextResponse.json({ error: "Could not read the allowlist" }, { status: 500 });
  }
  const existing = data as Existing | null;
  if (existing?.role === "admin") {
    return NextResponse.json({ error: `${body.email} is an admin; admins can't be changed here` }, { status: 409 });
  }
  const wasPicker = existing?.role === "picker";

  if (body.action === "set") {
    const sameRole = existing?.role === body.role;
    const desk =
      body.role !== "desk" ? null : body.desk !== undefined ? body.desk : sameRole ? (existing?.desk ?? null) : null;
    const wanted: readonly string[] =
      body.role !== "picker" ? [] : body.items !== undefined ? body.items : sameRole ? (existing?.picker_items ?? []) : [];
    const items = ITEMS.filter((k) => wanted.includes(k));

    // A newly chosen desk must be one of the current event's desks (kit_pigeonholes stations).
    if (body.role === "desk" && body.desk) {
      const { event } = await getAdminEvent();
      const stations = event ? await listStations(event.id) : [];
      if (!stations.includes(body.desk)) {
        return NextResponse.json({ error: `Desk ${body.desk} isn't set up for this event` }, { status: 400 });
      }
    }

    const { error } = await supabase
      .from("admin_allowlist")
      .upsert({ email: body.email, role: body.role, desk, picker_items: items });
    if (error) {
      console.error("volunteers upsert failed", error);
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }

    // Their phone follows at once: the next offer uses the new items; none left = paused.
    if ((wasPicker || body.role === "picker") && !(await syncPicker(supabase, body.email, items))) {
      revalidateTag("admin-allowlist", { expire: 0 });
      return NextResponse.json({ error: "Saved, but the picker's screen wasn't updated: save it again" }, { status: 500 });
    }
  } else {
    if (!existing) return NextResponse.json({ ok: true });
    const { error } = await supabase.from("admin_allowlist").delete().eq("email", body.email).neq("role", "admin");
    if (error) {
      console.error("volunteers delete failed", error);
      return NextResponse.json({ error: "Remove failed" }, { status: 500 });
    }
    // A removed picker is paused; an offer on their screen goes to someone else.
    if (wasPicker) await syncPicker(supabase, body.email, []);
  }

  // Drop the cached role and assignment now (not after up to 60 s), so a change reaches the
  // volunteer on their next request and a removal locks them out.
  revalidateTag("admin-allowlist", { expire: 0 });
  return NextResponse.json({ ok: true });
}
