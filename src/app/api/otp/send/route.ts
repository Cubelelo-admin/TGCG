import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendWhatsAppTemplate } from "@/lib/aisensy";
import {
  PHONE_REGEX,
  OTP_TTL_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  generateOtpCode,
  hashOtpCode,
} from "@/lib/otp";

export const runtime = "nodejs";

/**
 * Sends a fresh OTP to the primary attendee's phone via WhatsApp (AiSensy).
 * Called before any registration/group row exists, so verification state
 * lives in its own table (phone_otp_verifications) keyed by phone number —
 * see 0012_phone_otp.sql.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? body.phone : "";
  const phoneCountryCode =
    typeof body.phoneCountryCode === "string" && body.phoneCountryCode ? body.phoneCountryCode : "+91";

  if (!PHONE_REGEX.test(phone)) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
  }

  const campaignName = process.env.AISENSY_OTP_CAMPAIGN;
  if (!campaignName) {
    return NextResponse.json(
      { error: "Phone verification isn't available right now. Please try again later." },
      { status: 503 }
    );
  }

  const supabase = createServiceClient();

  const { data: recent } = await supabase
    .from("phone_otp_verifications")
    .select("created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && Date.now() - new Date(recent.created_at).getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    return NextResponse.json(
      { error: "Please wait a moment before requesting another code" },
      { status: 429 }
    );
  }

  const code = generateOtpCode();
  const { error: insertError } = await supabase.from("phone_otp_verifications").insert({
    phone,
    phone_country_code: phoneCountryCode,
    code_hash: hashOtpCode(code),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  if (insertError) {
    console.error("phone_otp_verifications insert failed", insertError);
    return NextResponse.json({ error: "Could not start verification. Please try again." }, { status: 500 });
  }

  try {
    await sendWhatsAppTemplate({
      campaignName,
      destinationPhoneE164: `${phoneCountryCode}${phone}`,
      userName: "there",
      templateParams: [code],
      // This template's approved button is a URL button that requires some
      // parameter to be present or AiSensy accepts the request (HTTP 200)
      // but then fails it downstream ("Button at index 0 of type Url
      // requires a parameter") — confirmed via AiSensy's campaign dashboard.
      // The button itself is unrelated to OTP verification, so the value
      // filled in here is a placeholder, not something shown to the user.
      buttons: [
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [{ type: "text", text: "VERIFY" }],
        },
      ],
    });
  } catch (err) {
    console.error("OTP WhatsApp send failed", err);
    return NextResponse.json(
      { error: "Could not send the verification code. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
