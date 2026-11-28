import { requireAdmin } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import { Card, EmptyState, PageHeader } from "@/components/ds";
import FloorBoard from "./FloorBoard";

export default async function KitFloorPage() {
  // Supervisors only: the board can release tasks and cancel orders.
  await requireAdmin();
  const { event } = await getAdminEvent();

  return (
    <div>
      <PageHeader
        title="Floor board"
        subtitle="Every open order, picker, pigeonhole and empty bin. Anything stuck shows at the top: release a task a picker has gone quiet on."
      />
      {event ? (
        <FloorBoard eventId={event.id} />
      ) : (
        <Card>
          <EmptyState title="No active event found." />
        </Card>
      )}
    </div>
  );
}
