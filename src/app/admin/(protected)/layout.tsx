import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminSession, isVolunteer, VOLUNTEER_HOME } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import AdminShell from "./AdminShell";

/**
 * Shell only. This check is NOT the access control: a layout doesn't stop its pages from
 * rendering (Next 16 docs, "Layouts and auth checks"), so every page calls requireAdmin()
 * itself, and every API route checks the session role. Volunteers use the volunteer app (/v).
 */
export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.role) redirect("/admin/denied");
  if (isVolunteer(session.role)) redirect(VOLUNTEER_HOME);

  const { event, events } = await getAdminEvent();

  return (
    <AdminShell
      email={session.email}
      events={events.map((e) => ({ slug: e.slug, name: e.name, is_active: e.is_active }))}
      selectedSlug={event?.slug ?? null}
    >
      {children}
    </AdminShell>
  );
}
