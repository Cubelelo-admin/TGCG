import { requireStation } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import { listStations } from "@/lib/expo";
import { Card, EmptyState, PageHeader } from "@/components/ds";
import DeskStation from "./DeskStation";

export default async function KitDeskPage() {
  const session = await requireStation("desk");
  const { event } = await getAdminEvent();
  if (!event) {
    return (
      <div>
        <PageHeader title="Collection desk" />
        <Card>
          <EmptyState title="No active event found." />
        </Card>
      </div>
    );
  }
  const stations = await listStations(event.id);

  return (
    <div>
      <PageHeader
        title="Collection desk"
        subtitle="Scan the runner's pass to start an order. When it turns Ready, scan the crate and hand the kit over."
      />
      <DeskStation eventId={event.id} stations={stations} canCancel={session.role === "admin"} />
    </div>
  );
}
