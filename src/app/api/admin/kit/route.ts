import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { loadBox, loadGroupBoxes, lookupRunner } from "@/lib/kit";

export const runtime = "nodejs";

const code = z.string().trim().min(1).max(60);
const eventId = z.string().uuid();

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), eventId, boxSize: z.number().int().min(5).max(60).optional() }),
  z.object({
    action: z.literal("set-channel"),
    eventId,
    pocName: z.string().trim().min(1).max(200),
    channel: z.enum(["expo", "corporate"]),
  }),
  z.object({ action: z.literal("box"), boxCode: code }),
  z.object({ action: z.literal("scan"), boxCode: code, code }),
  z.object({ action: z.literal("stage"), boxCode: code }),
  z.object({ action: z.literal("groups"), eventId }),
  z.object({
    action: z.literal("handover"),
    eventId,
    group: z.string().trim().min(1).max(200),
    receiverName: z.string().trim().min(2).max(120),
    receiverMobile: z.string().trim().regex(/^\d{10}$/, "Enter a 10-digit mobile number"),
    boxCodes: z.array(code).min(1).max(200),
  }),
  z.object({ action: z.literal("lookup"), eventId, code }),
  z.object({ action: z.literal("collect"), bagCode: code, registrationId: z.string().uuid() }),
]);

type RpcResult = { ok: boolean; message?: string } & Record<string, unknown>;

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

  // The RPCs return {ok, message, ...}; a business rejection is a 200 with ok:false
  // so the scan screens can show the reason in their banner without special-casing.
  async function rpc(fn: string, args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      console.error(`${fn} failed`, error);
      return NextResponse.json({ ok: false, message: "Server error, scan again" }, { status: 500 });
    }
    return NextResponse.json(data as RpcResult);
  }

  switch (body.action) {
    case "generate":
      return rpc("kit_generate_boxes", { p_event_id: body.eventId, p_box_size: body.boxSize ?? 20 });

    case "set-channel": {
      // Only runners with no box yet: once a runner is boxed, changing channel would orphan their items.
      const { data: candidates, error: readError } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", body.eventId)
        .eq("payment_status", "paid")
        .eq("poc_name", body.pocName)
        .limit(1000);
      if (readError) return NextResponse.json({ ok: false, message: "Could not read registrations" }, { status: 500 });

      const ids = (candidates ?? []).map((r) => r.id as string);
      const { data: boxed } = await supabase.from("kit_items").select("registration_id").in("registration_id", ids);
      const boxedIds = new Set((boxed ?? []).map((r) => r.registration_id as string));
      const free = ids.filter((id) => !boxedIds.has(id));

      if (free.length > 0) {
        const { error } = await supabase
          .from("registrations")
          .update({
            kit_channel: body.channel,
            kit_group: body.channel === "corporate" ? body.pocName : null,
          })
          .in("id", free);
        if (error) {
          console.error("set-channel failed", error);
          return NextResponse.json({ ok: false, message: "Could not update channel" }, { status: 500 });
        }
      }
      return NextResponse.json({
        ok: true,
        updated: free.length,
        skipped: ids.length - free.length,
        message:
          ids.length - free.length > 0
            ? `${free.length} updated, ${ids.length - free.length} already boxed (unchanged)`
            : `${free.length} updated`,
      });
    }

    case "box": {
      const box = await loadBox(body.boxCode);
      if (!box) return NextResponse.json({ ok: false, message: "Unknown box label" });
      return NextResponse.json({ ok: true, box });
    }

    case "scan": {
      const res = await supabase.rpc("kit_scan", {
        p_box_code: body.boxCode,
        p_code: body.code,
        p_admin: session.email,
      });
      if (res.error) {
        console.error("kit_scan failed", res.error);
        return NextResponse.json({ ok: false, message: "Server error, scan again" }, { status: 500 });
      }
      const box = await loadBox(body.boxCode);
      return NextResponse.json({ ...(res.data as RpcResult), box });
    }

    case "stage":
      return rpc("kit_stage", { p_box_code: body.boxCode, p_admin: session.email });

    case "groups":
      return NextResponse.json({ ok: true, groups: await loadGroupBoxes(body.eventId) });

    case "handover":
      return rpc("kit_handover", {
        p_event_id: body.eventId,
        p_group: body.group,
        p_name: body.receiverName,
        p_mobile: body.receiverMobile,
        p_codes: body.boxCodes,
        p_admin: session.email,
      });

    case "lookup": {
      const runner = await lookupRunner(body.eventId, body.code);
      if (!runner) return NextResponse.json({ ok: false, message: "No paid runner found for that pass or BIB" });
      return NextResponse.json({ ok: true, runner });
    }

    case "collect":
      return rpc("kit_collect", { p_bag_code: body.bagCode, p_reg_id: body.registrationId, p_admin: session.email });
  }
}
