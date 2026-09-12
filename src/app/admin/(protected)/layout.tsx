import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/admin-auth";
import SignOutButton from "./SignOutButton";

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
      <main className="flex-1 flex items-center justify-center bg-neutral-950 text-neutral-50 px-6">
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

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 text-neutral-50">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <Image src="/logo.png" alt="" width={300} height={300} className="h-7 w-7" />
              TGCG Admin
            </Link>
            <Link href="/admin/registrations" className="text-neutral-400 hover:text-neutral-200">
              Registrations
            </Link>
          </nav>
          <div className="flex items-center gap-4 text-sm text-neutral-400">
            <span>{session.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
