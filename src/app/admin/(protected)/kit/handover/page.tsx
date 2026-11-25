import { getAdminEvent } from "@/lib/admin-event";
import { EmptyState, PageHeader } from "@/components/ds";
import HandoverStation from "./HandoverStation";

export default async function KitHandoverPage() {
  const { event } = await getAdminEvent();
  if (!event) return <EmptyState title="No event found." />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Corporate handover (day 0)"
        subtitle={`${event.name}. Stage each ready group box, then on day 0 scan every box of a group out to the company rep and record who collected it.`}
      />
      <HandoverStation eventId={event.id} />
    </div>
  );
}
