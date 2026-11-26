import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/*
 * Volunteer app sign-in with a 6-digit email code. Needed on iPhone: an app installed to the
 * home screen keeps its own cookies, and a Google sign-in there can finish in a separate
 * Safari view and never come back signed in. The code is typed inside the app instead, and
 * the browser verifies it (supabase.auth.verifyOtp), so the session lands in the app.
 *
 * A code is only sent to emails on admin_allowlist, so this can't be used to create accounts
 * or send mail to strangers. The reply is the same either way (it doesn't reveal who is on
 * the list). Supabase's own per-email and per-project email limits still apply.
 *
 * Setup (Supabase dashboard): Authentication → Email Templates → "Magic Link" must include
 * {{ .Token }} (the 6-digit code), and a custom SMTP sender is needed for more than a handful
 * of emails an hour.
 */

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email").max(200) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email } = parsed.data;
  const sent = NextResponse.json({ ok: true, message: `If ${email} is on the volunteer list, a code is on its way.` });

  const { data: row, error } = await createServiceClient()
    .from("admin_allowlist")
    .select("role")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    console.error("otp allowlist lookup failed", error);
    return NextResponse.json({ error: "Server error: try again" }, { status: 500 });
  }
  if (!row) return sent;

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: otpError } = await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otpError) {
    console.error("signInWithOtp failed", otpError.status, otpError.message);
    const limited = otpError.status === 429 || /rate limit|security purposes/i.test(otpError.message);
    return NextResponse.json(
      { error: limited ? "Too many codes requested. Wait a minute and try again." : "Couldn't send the code: try again" },
      { status: limited ? 429 : 500 }
    );
  }
  return sent;
}
