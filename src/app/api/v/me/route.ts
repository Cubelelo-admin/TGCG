import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * The signed-in volunteer's current role. The volunteer app polls this so that when an admin
 * changes someone's role (Configuration → Volunteers), their phone switches screen by itself.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ role: null, signedIn: false }, { status: 401 });
  return NextResponse.json({ role: session.role, signedIn: true }, { headers: { "Cache-Control": "no-store" } });
}
