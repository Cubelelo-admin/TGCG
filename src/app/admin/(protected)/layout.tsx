import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import AdminShell from "./AdminShell";

/**
 * Shell only. This check is NOT the access control: a layout doesn't stop its pages from
 * rendering (Next 16 docs, "Layouts and auth checks"), so every page calls requireAdmin()
 * or requireStation() itself, and every API route checks the session role.
 */
export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.role) redirect("/admin/denied");

  const { event, events } = await getAdminEvent();

  return (
    <AdminShell
      email={session.email}
      role={session.role}
      events={events.map((e) => ({ slug: e.slug, name: e.name, is_active: e.is_active }))}
      selectedSlug={event?.slug ?? null}
    >
      {children}
    </AdminShell>
  );
}
