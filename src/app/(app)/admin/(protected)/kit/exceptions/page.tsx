import { requireAdmin } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import { getRecentExceptions } from "@/lib/kit";
import { Card, EmptyState, PageHeader } from "@/components/ds";
import ExceptionsDesk from "./ExceptionsDesk";
import ExceptionLog, { type ExceptionLogRow } from "./ExceptionLog";

export default async function KitExceptionsPage() {
  await requireAdmin();
  const { event } = await getAdminEvent();
  if (!event) return <EmptyState title="No event found." />;

  const recent = await getRecentExceptions(event.id);

  // Formatted here (not in the client table) so server and browser render the same string.
  const rows: ExceptionLogRow[] = recent.map((e) => ({
    id: e.id,
    when: new Date(e.createdAt).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    ok: e.ok,
    what: e.detail ?? e.action,
    actor: e.actor,
  }));

  return (
    <div className="max-w-[1040px]">
      <PageHeader
        title="Exceptions desk"
        subtitle={
          <>
            {event.name}. Size swaps, lost passes, unpaid runners, late sign-ups and kits handed over without a bag
            scan. Search by name, mobile, BIB or pass code. Every change is logged with who made it.
          </>
        }
      />

      <ExceptionsDesk eventId={event.id} />

      <Card title="Recent exceptions and rejected scans" className="mt-6">
        <ExceptionLog rows={rows} />
      </Card>
    </div>
  );
}
