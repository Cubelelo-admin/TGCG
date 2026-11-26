import Image from "next/image";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ds";
import { getAdminSession, VOLUNTEER_HOME } from "@/lib/admin-auth";
import SignOutButton from "../(protected)/SignOutButton";

/** Signed in with Google, but the email isn't on admin_allowlist. Renders no data. */
export default async function AdminDeniedPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role === "admin") redirect("/admin");
  if (session.role) redirect(VOLUNTEER_HOME);

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
          admin dashboard. Ask an organizer to add this email as an admin or volunteer.
        </p>
        <SignOutButton variant="dark" className="mt-6 w-full" />
      </div>
    </main>
  );
}
