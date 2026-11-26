import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/*
 * Volunteers on admin_allowlist (desk | picker | handover | restock, 0031). Full admins only. Admin rows are
 * never created, changed or removed here, so nobody can lock an organiser out from the UI;
 * promoting someone to admin stays a deliberate SQL change.
 */

const email = z.string().trim().toLowerCase().email("Enter a valid email").max(200);
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set"), email, role: z.enum(["desk", "picker", "handover", "restock"]) }),
  z.object({ action: z.literal("remove"), email }),
]);

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

  const { data: existing, error: readError } = await supabase
    .from("admin_allowlist")
    .select("role")
    .eq("email", body.email)
    .maybeSingle();
  if (readError) {
    console.error("volunteers read failed", readError);
    return NextResponse.json({ error: "Could not read the allowlist" }, { status: 500 });
  }
  if (existing?.role === "admin") {
    return NextResponse.json({ error: `${body.email} is an admin; admins can't be changed here` }, { status: 409 });
  }

  if (body.action === "set") {
    const { error } = await supabase.from("admin_allowlist").upsert({ email: body.email, role: body.role });
    if (error) {
      console.error("volunteers upsert failed", error);
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }
  } else {
    if (!existing) return NextResponse.json({ ok: true });
    const { error } = await supabase.from("admin_allowlist").delete().eq("email", body.email).neq("role", "admin");
    if (error) {
      console.error("volunteers delete failed", error);
      return NextResponse.json({ error: "Remove failed" }, { status: 500 });
    }
  }

  // Drop the cached role now (not after up to 60 s), so a removal locks the volunteer out
  // on their next request.
  revalidateTag("admin-allowlist", { expire: 0 });
  return NextResponse.json({ ok: true });
}
