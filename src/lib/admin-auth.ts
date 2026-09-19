import "server-only";
import { unstable_cache } from "next/cache";
import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

export interface AdminSession {
  email: string;
  authorized: boolean;
}

// admin_allowlist changes essentially never — every admin navigation was
// paying for a fresh Postgres round trip just to re-check the same email.
// Short revalidate window trades a few seconds of staleness (if someone is
// removed from the allowlist) for cutting this off every page load.
const isAllowlisted = unstable_cache(
  async (email: string): Promise<boolean> => {
    const service = createServiceClient();
    const { data } = await service
      .from("admin_allowlist")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    return Boolean(data);
  },
  ["admin-allowlist-check"],
  { revalidate: 60 }
);

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

  const authorized = await isAllowlisted(user.email.toLowerCase());
  return { email: user.email, authorized };
}
