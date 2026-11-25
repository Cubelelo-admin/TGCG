import { getAdminEvent } from "@/lib/admin-event";
import { EmptyState, PageHeader } from "@/components/ds";
import CounterStation from "./CounterStation";

export default async function KitCounterPage() {
  const { event } = await getAdminEvent();
  if (!event) return <EmptyState title="No event found." />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Expo counter"
        subtitle={`${event.name}. Scan the runner's pass, check their ID against the last 4 digits, fetch the bag from the shelf shown, scan the bag to confirm.`}
      />
      <CounterStation eventId={event.id} />
    </div>
  );
}
