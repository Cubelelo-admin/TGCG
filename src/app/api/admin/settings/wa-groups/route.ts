import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { saveWaGroupSettings } from "@/lib/app-settings";

export const runtime = "nodejs";

const urlOrEmpty = z.string().trim().url().optional().or(z.literal(""));

const updateSchema = z.object({
  wa_group_42_21: urlOrEmpty,
  wa_group_10: urlOrEmpty,
  wa_group_6_1: urlOrEmpty,
  wa_group_6_2: urlOrEmpty,
  wa_group_6_3: urlOrEmpty,
  active_6k_wa_group: z.enum(["1", "2", "3"]),
});

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const error = await saveWaGroupSettings(parsed.data);
  if (error) {
    console.error("wa-groups settings save failed", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
