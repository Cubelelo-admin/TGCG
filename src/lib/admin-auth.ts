import "server-only";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * admin_allowlist.role (0030, widened in 0031). 'admin' is the full dashboard. Every other
 * role is a volunteer: they only use the volunteer app (/v), which shows the screen for their
 * role, and only that screen's API actions. Never runner contact details or the registrations list.
 */
export type AdminRole = "admin" | "desk" | "picker" | "handover" | "restock";
export type VolunteerRole = Exclude<AdminRole, "admin">;
export const VOLUNTEER_ROLES: readonly VolunteerRole[] = ["desk", "picker", "handover", "restock"];
const ROLES: readonly AdminRole[] = ["admin", ...VOLUNTEER_ROLES];

/** The volunteer app: one URL, the role decides the screen. */
export const VOLUNTEER_HOME = "/v";

export interface AdminSession {
  email: string;
  /** Name from the Google profile, when the token carries one. */
  name: string | null;
  /** null = signed in but not on the allowlist. */
  role: AdminRole | null;
  /**
   * Full admin (role 'admin'). Every pre-role check in the app reads this, so volunteers
   * are kept out of everything that existed before roles.
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

export function isVolunteer(role: AdminRole | null): role is VolunteerRole {
  return role !== null && role !== "admin";
}

/**
 * Page guard for full-admin screens. Call it at the top of every page under (protected):
 * the layout's check alone does not stop a page from rendering into the RSC payload
 * (Next 16 docs, "Layouts and auth checks"). Volunteers are sent to the volunteer app.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (isVolunteer(session.role)) redirect(VOLUNTEER_HOME);
  if (session.role !== "admin") redirect("/admin/denied");
  return session;
}

/** Page guard for the volunteer app: any volunteer role, or an admin (supervising / testing). */
export async function requireVolunteerApp(): Promise<AdminSession & { role: AdminRole }> {
  const session = await getAdminSession();
  if (!session) redirect("/v/login");
  if (!session.role) redirect("/v/denied");
  return session as AdminSession & { role: AdminRole };
}
