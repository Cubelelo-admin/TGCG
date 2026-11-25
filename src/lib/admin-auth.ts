import "server-only";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * admin_allowlist.role (0030). 'admin' is the full dashboard. 'desk' and 'picker' are expo
 * volunteers: they only reach their own station screen and its API actions, never runner
 * contact details or the registrations list.
 */
export type AdminRole = "admin" | "desk" | "picker";
const ROLES: readonly AdminRole[] = ["admin", "desk", "picker"];

export interface AdminSession {
  email: string;
  /** Name from the Google profile, when the token carries one. */
  name: string | null;
  /** null = signed in but not on the allowlist. */
  role: AdminRole | null;
  /**
   * Full admin (role 'admin'). Every pre-role check in the app reads this, so desk and
   * picker volunteers are kept out of everything that existed before roles.
   */
  authorized: boolean;
}

// admin_allowlist changes rarely — every admin navigation was paying for a fresh
// Postgres round trip just to re-check the same email. The short revalidate window
// trades up to a minute of staleness (adding, removing or re-roling a volunteer)
// for cutting this off every page load.
const allowlistRole = unstable_cache(
  async (email: string): Promise<AdminRole | null> => {
    const service = createServiceClient();
    const { data, error } = await service.from("admin_allowlist").select("role").eq("email", email).maybeSingle();
    if (error) {
      console.error("admin_allowlist lookup failed", error);
      return null;
    }
    if (!data) return null;
    // Unknown value (should be impossible: check constraint) = least privilege.
    return ROLES.includes(data.role as AdminRole) ? (data.role as AdminRole) : null;
  },
  ["admin-allowlist-role"],
  { revalidate: 60, tags: ["admin-allowlist"] }
);

/**
 * Returns the current Supabase Auth session (if any) plus the email's allowlist role.
 * Check `authorized` (full admin) or use the require* helpers below before touching any
 * PII in admin route handlers / server components.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const authClient = await createServerAuthClient();
  // Local JWT verification: no Auth-server round trip per request (see middleware-client.ts).
  const { data } = await authClient.auth.getClaims();
  const claims = data?.claims;
  const email = typeof claims?.email === "string" ? claims.email : null;
  if (!email) return null;

  const meta = (claims?.user_metadata ?? {}) as Record<string, unknown>;
  const rawName = meta.full_name ?? meta.name;
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;

  const role = await allowlistRole(email.toLowerCase());
  return { email, name, role, authorized: role === "admin" };
}

/** Where each volunteer role lands; also where they are sent from any other admin page. */
export const STATION_HOME: Record<Exclude<AdminRole, "admin">, string> = {
  desk: "/admin/kit/desk",
  picker: "/admin/kit/picker",
};

/**
 * Page guard for full-admin screens. Call it at the top of every page under (protected):
 * the layout's check alone does not stop a page from rendering into the RSC payload
 * (Next 16 docs, "Layouts and auth checks"). Volunteers are sent to their station.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role === "desk" || session.role === "picker") redirect(STATION_HOME[session.role]);
  if (session.role !== "admin") redirect("/admin/denied");
  return session;
}

/** Page guard for a volunteer station: that role, or a full admin (supervising / testing). */
export async function requireStation(station: "desk" | "picker"): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role === "admin" || session.role === station) return session;
  if (session.role === "desk" || session.role === "picker") redirect(STATION_HOME[session.role]);
  redirect("/admin/denied");
}
