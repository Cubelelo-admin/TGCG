import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import SignOutButton from "./SignOutButton";
import EventSwitcher from "./EventSwitcher";

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
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold">Access denied</h1>
          <p className="mt-2 text-sm text-neutral-400">
            {session.email} is signed in but not authorized to view the admin
            dashboard. Ask an organizer to add this email to admin_allowlist.
          </p>
          <SignOutButton className="mt-6" />
        </div>
      </main>
    );
  }

  const { event, events } = await getAdminEvent();

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-50">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <nav className="flex items-center gap-4 text-sm sm:gap-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <Image src="/logo.png" alt="" width={300} height={202} className="h-8 w-auto shrink-0 rounded" />
              <span className="whitespace-nowrap">TGCG Admin</span>
            </Link>
            <Link href="/admin/registrations" className="whitespace-nowrap text-neutral-400 hover:text-neutral-200">
              Registrations
            </Link>
            <Link href="/admin/assets" className="whitespace-nowrap text-neutral-400 hover:text-neutral-200">
              Configuration
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm text-neutral-400 sm:gap-4">
            <EventSwitcher
              events={events.map((e) => ({ slug: e.slug, name: e.name, is_active: e.is_active }))}
              selectedSlug={event?.slug ?? null}
            />
            <span className="hidden truncate sm:inline">{session.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1920px] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
