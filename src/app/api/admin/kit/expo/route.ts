import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, type AdminRole } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { deskLookup, dispatch, findOpenOrder, loadDeskBoard, loadPickerState, loadRestockBoard } from "@/lib/expo";

export const runtime = "nodejs";

/*
 * Expo on-demand flow (0030, bin alerts 0031). Desk actions: desk volunteers + admins.
 * Picker actions: pickers + admins. Restock actions: restock volunteers + admins.
 * Cancel: admins only (support). The picker / restocker is always the signed-in email;
 * it is never taken from the request body.
 */

const uuid = z.string().uuid();
const eventId = uuid;
const code = z.string().trim().min(1).max(60);
const station = z.string().trim().min(1).max(10);
const kind = z.enum(["bib", "tshirt", "pack"]);

const bodySchema = z.discriminatedUnion("action", [
  // desk
  z.object({ action: z.literal("desk-board"), eventId, station: station.nullable() }),
  z.object({ action: z.literal("desk-lookup"), eventId, code }),
  z.object({ action: z.literal("create-order"), eventId, station, registrationIds: z.array(uuid).min(1).max(10) }),
  z.object({ action: z.literal("order-preview"), eventId, code }),
  z.object({ action: z.literal("fulfil"), eventId, code }),
  // support
  z.object({ action: z.literal("cancel-order"), orderId: uuid, reason: z.string().trim().min(3, "A reason is required").max(200) }),
  // picker
  z.object({ action: z.literal("picker-state"), eventId }),
  z.object({ action: z.literal("set-active"), eventId, active: z.boolean(), specialties: z.array(kind).min(1).max(3) }),
  z.object({ action: z.literal("accept"), taskId: uuid }),
  z.object({ action: z.literal("decline"), taskId: uuid }),
  z.object({ action: z.literal("pick-bin"), taskId: uuid, bin: code }),
  z.object({ action: z.literal("pick-item"), taskId: uuid, lineIds: z.array(uuid).min(1).max(20), scan: z.string().trim().max(60).optional() }),
  z.object({ action: z.literal("put-away"), taskId: uuid, crate: code }),
  z.object({ action: z.literal("bin-empty"), taskId: uuid, bin: code }),
  // restock
  z.object({ action: z.literal("restock-board"), eventId }),
  z.object({ action: z.literal("bin-refilled"), eventId, bin: code }),
]);

type Body = z.infer<typeof bodySchema>;
const DESK_ACTIONS = new Set<Body["action"]>(["desk-board", "desk-lookup", "create-order", "order-preview", "fulfil"]);
const PICKER_ACTIONS = new Set<Body["action"]>([
  "picker-state",
  "set-active",
  "accept",
  "decline",
  "pick-bin",
  "pick-item",
  "put-away",
  "bin-empty",
]);
const RESTOCK_ACTIONS = new Set<Body["action"]>(["restock-board", "bin-refilled"]);

function allowed(role: AdminRole | null, action: Body["action"]): boolean {
  if (role === "admin") return true;
  if (role === "desk") return DESK_ACTIONS.has(action);
  if (role === "picker") return PICKER_ACTIONS.has(action);
  if (role === "restock") return RESTOCK_ACTIONS.has(action);
  return false;
}

type RpcResult = { ok: boolean; message?: string } & Record<string, unknown>;

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session?.role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const body = parsed.data;
  if (!allowed(session.role, body.action)) return NextResponse.json({ error: "Not allowed for your role" }, { status: 403 });

  const supabase = createServiceClient();
  const email = session.email.toLowerCase();

  // Business rejections come back as 200 {ok:false, message} so the screens show them in the banner.
  async function rpc(fn: string, args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      console.error(`${fn} failed`, error);
      return NextResponse.json({ ok: false, message: "Server error: try again" }, { status: 500 });
    }
    return NextResponse.json(data as RpcResult);
  }

  switch (body.action) {
    case "desk-board":
      await dispatch(body.eventId);
      return NextResponse.json({ ok: true, board: await loadDeskBoard(body.eventId, body.station) });

    case "desk-lookup": {
      const found = await deskLookup(body.eventId, body.code);
      if (!found) return NextResponse.json({ ok: false, message: `No paid runner for "${body.code}"` });
      return NextResponse.json({ ok: true, lookup: found });
    }

    case "create-order":
      return rpc("kit_create_order", {
        p_event_id: body.eventId,
        p_reg_ids: body.registrationIds,
        p_station: body.station,
        p_admin: email,
      });

    case "order-preview": {
      const order = await findOpenOrder(body.eventId, body.code);
      if (!order) return NextResponse.json({ ok: false, message: `No open order for ${body.code.toUpperCase()}` });
      return NextResponse.json({ ok: true, order });
    }

    case "fulfil":
      return rpc("kit_fulfil_order", { p_event_id: body.eventId, p_code: body.code, p_photo: null, p_admin: email });

    case "cancel-order":
      return rpc("kit_cancel_order", { p_order: body.orderId, p_reason: body.reason, p_admin: email });

    case "picker-state":
      await dispatch(body.eventId);
      return NextResponse.json({
        ok: true,
        state: await loadPickerState(body.eventId, email),
        // Lets the phone correct its clock for the 60 s offer countdown.
        now: new Date().toISOString(),
      });

    case "set-active":
      return rpc("kit_picker_set_active", {
        p_event_id: body.eventId,
        p_email: email,
        p_name: session.name,
        p_active: body.active,
        p_specialties: body.specialties,
      });

    case "accept":
      return rpc("kit_accept_task", { p_task: body.taskId, p_email: email });

    case "decline":
      return rpc("kit_decline_task", { p_task: body.taskId, p_email: email });

    case "pick-bin":
      // Returns the lines in that bin (size / BIB). The screen reloads state afterwards.
      return rpc("kit_pick_bin", { p_task: body.taskId, p_bin: body.bin, p_email: email });

    case "pick-item":
      return rpc("kit_pick_item", { p_task: body.taskId, p_line_ids: body.lineIds, p_scan: body.scan ?? null, p_email: email });

    case "put-away":
      return rpc("kit_put_away", { p_task: body.taskId, p_crate: body.crate, p_email: email });

    case "bin-empty":
      return rpc("kit_bin_empty", { p_task: body.taskId, p_bin: body.bin, p_email: email });

    case "restock-board":
      return NextResponse.json({ ok: true, board: await loadRestockBoard(body.eventId), now: new Date().toISOString() });

    case "bin-refilled":
      return rpc("kit_bin_refilled", { p_event_id: body.eventId, p_bin: body.bin, p_email: email });
  }
}
