import Image from "next/image";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ds";
import { getAdminSession } from "@/lib/admin-auth";
import SignOutButton from "../../admin/(protected)/SignOutButton";

/** Signed in, but the email isn't on the volunteer list. Renders no data. */
export default async function VolunteerDeniedPage() {
  const session = await getAdminSession();
  if (!session) redirect("/v/login");
  if (session.role) redirect("/v");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-dark px-4 py-10">
      <div className="w-full max-w-sm rounded-12 bg-white p-6 text-center shadow-dock-xl">
        <Image src="/app-icons/volunteer-192.png" alt="" width={56} height={56} className="mx-auto h-14 w-14 rounded-12" />
        <span className="mx-auto mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-tint-red text-on-tint-red">
          <Icon name="lock" size={20} />
        </span>
        <h1 className="mt-3 text-20 font-semibold text-ink">Not on the volunteer list</h1>
        <p className="mt-2 text-14 text-ink-tertiary">
          <span className="break-all font-medium text-ink">{session.email}</span> is signed in but hasn&apos;t been added
          as a volunteer. Ask an organiser to add this email in Configuration → Volunteers.
        </p>
        <SignOutButton variant="dark" to="/v/login" className="mt-6 h-12! w-full" />
      </div>
    </main>
  );
}
