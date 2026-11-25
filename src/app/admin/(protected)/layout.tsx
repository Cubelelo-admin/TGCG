import { redirect } from "next/navigation";
import Image from "next/image";
import type { ReactNode } from "react";
import { Icon } from "@/components/ds";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import SignOutButton from "./SignOutButton";
import AdminShell from "./AdminShell";

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  if (!session.authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-10">
        <div className="w-full max-w-[400px] rounded-12 border border-line-secondary bg-white p-8 text-center shadow-card">
          <Image src="/logo.png" alt="" width={300} height={202} className="mx-auto h-12 w-auto rounded-8" />
          <span className="mx-auto mt-6 flex h-10 w-10 items-center justify-center rounded-full bg-tint-red text-on-tint-red">
            <Icon name="lock" size={20} />
          </span>
          <h1 className="mt-3 text-20 font-semibold text-ink">Access denied</h1>
          <p className="mt-2 text-14 text-ink-tertiary">
            <span className="font-medium text-ink">{session.email}</span> is signed in but not authorized to view the
            admin dashboard. Ask an organizer to add this email to admin_allowlist.
          </p>
          <SignOutButton variant="dark" className="mt-6 w-full" />
        </div>
      </main>
    );
  }

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
