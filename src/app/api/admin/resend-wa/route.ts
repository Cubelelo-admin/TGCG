import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { notifyRegistrationPaid } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { registrationId } = await request.json().catch(() => ({}));
  if (!registrationId) {
    return NextResponse.json({ error: "Missing registrationId" }, { status: 400 });
  }

  await notifyRegistrationPaid(registrationId);
  return NextResponse.json({ ok: true });
}
