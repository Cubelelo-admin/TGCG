import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

/**
 * Supabase redirects here after a Google OAuth sign-in with a `code` to
 * exchange for a session. admin_allowlist authorization is still checked
 * separately by getAdminSession() — this route only establishes who the
 * user is, not whether they're allowed into /admin.
 */
// Only ever redirect to a same-origin relative path — `next` is attacker-
// controlled input, and a bare `${origin}${next}` concatenation is an open
// redirect (e.g. next="@evil.com" parses as a userinfo/host, not a path).
function safeNextPath(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    return next;
  }
  return "/admin";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createServerAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/admin/login?error=auth`);
}
