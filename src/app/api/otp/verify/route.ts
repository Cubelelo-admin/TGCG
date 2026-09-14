import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { OTP_MAX_ATTEMPTS, hashOtpCode } from "@/lib/otp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? body.phone : "";
  const code = typeof body.code === "string" ? body.code : "";

  if (!phone || !code) {
    return NextResponse.json({ error: "Missing phone or code" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("phone_otp_verifications")
    .select("id, code_hash, expires_at, attempt_count, verified_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Request a verification code first" }, { status: 404 });
  }
  if (row.verified_at) {
    return NextResponse.json({ ok: true }); // already verified — idempotent
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This code has expired. Request a new one." }, { status: 410 });
  }
  if (row.attempt_count >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
  }

  if (hashOtpCode(code) !== row.code_hash) {
    await supabase
      .from("phone_otp_verifications")
      .update({ attempt_count: row.attempt_count + 1 })
      .eq("id", row.id);
    return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
  }

  await supabase
    .from("phone_otp_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", row.id);

  return NextResponse.json({ ok: true });
}
