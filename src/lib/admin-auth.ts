import "server-only";
import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

export interface AdminSession {
  email: string;
  authorized: boolean;
}

/**
 * Returns the current Supabase Auth session (if any) plus whether that
 * email is present in admin_allowlist. `authorized` must be checked before
 * touching any PII in admin route handlers / server components.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const authClient = await createServerAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user?.email) return null;

  const service = createServiceClient();
  const { data } = await service
    .from("admin_allowlist")
    .select("email")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  return { email: user.email, authorized: Boolean(data) };
}
