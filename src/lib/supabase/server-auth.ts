import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Anon-key Supabase client bound to the current request's cookies, for
 * reading/writing the Supabase Auth session (admin login) from server
 * components and route handlers. This respects RLS — it is NOT the
 * service-role client and must not be used to read registrations/PII.
 */
export async function createServerAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component without a mutable response —
            // safe to ignore as long as middleware also refreshes the session.
          }
        },
      },
    }
  );
}
