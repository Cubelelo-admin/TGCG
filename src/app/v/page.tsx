import { requireVolunteerApp, VOLUNTEER_ROLES, type VolunteerRole } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import { listStations } from "@/lib/expo";
import VolunteerApp from "./VolunteerApp";

/**
 * The volunteer app (installable). The signed-in role decides the screen; the page guard runs
 * here (a layout check would not stop this page rendering, Next 16 "Layouts and auth checks").
 * Admins can preview any screen with ?as=desk|picker|handover|restock.
 */
export default async function VolunteerAppPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireVolunteerApp();
  const [{ event }, sp] = await Promise.all([getAdminEvent(), searchParams]);

  const asParam = typeof sp.as === "string" ? sp.as : "";
  const view: VolunteerRole =
    session.role === "admin"
      ? ((VOLUNTEER_ROLES as readonly string[]).includes(asParam) ? (asParam as VolunteerRole) : "desk")
      : session.role;

  const stations = view === "desk" && event ? await listStations(event.id) : [];

  return (
    <VolunteerApp
      email={session.email}
      role={session.role}
      view={view}
      eventId={event?.id ?? null}
      eventName={event?.name ?? ""}
      stations={stations}
    />
  );
}
