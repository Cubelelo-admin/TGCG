import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { OTP_MAX_ATTEMPTS, hashOtpCode } from "@/lib/otp";

export const runtime = "nodejs";

/**
 * Checks a code against the most recent OTP sent to this phone. Error
 * responses carry user-facing copy (shown verbatim in the registration
 * form's verification step) and, for a wrong code, `attemptsLeft` so the
 * form can say how many tries remain before a new code is needed.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? body.phone : "";
  const code = typeof body.code === "string" ? body.code : "";

  if (!phone) {
    return NextResponse.json({ error: "Missing phone number." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code from WhatsApp." }, { status: 400 });
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
    return NextResponse.json({ error: "Request a verification code first." }, { status: 404 });
  }
  if (row.verified_at) {
    return NextResponse.json({ ok: true }); // already verified — idempotent
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This code has expired. Tap Resend code to get a new one." },
      { status: 410 }
    );
  }
  if (row.attempt_count >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many incorrect attempts. Tap Resend code to get a new code.", attemptsLeft: 0 },
      { status: 429 }
    );
  }

  if (hashOtpCode(code) !== row.code_hash) {
    const attemptCount = row.attempt_count + 1;
    await supabase
      .from("phone_otp_verifications")
      .update({ attempt_count: attemptCount })
      .eq("id", row.id);
    const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - attemptCount);
    return NextResponse.json(
      {
        error:
          attemptsLeft > 0
            ? "That code doesn't match. Check the latest WhatsApp message and try again."
            : "That code doesn't match, and there are no attempts left. Tap Resend code to get a new code.",
        attemptsLeft,
      },
      { status: 400 }
    );
  }

  await supabase
    .from("phone_otp_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", row.id);

  return NextResponse.json({ ok: true });
}
