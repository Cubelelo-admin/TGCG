import { getAdminEvent } from "@/lib/admin-event";
import HandoverStation from "./HandoverStation";

export default async function KitHandoverPage() {
  const { event } = await getAdminEvent();
  if (!event) return <p className="text-neutral-400">No event found.</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Corporate handover (day 0)</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {event.name}. Stage each ready group box, then on day 0 scan every box of a group out to the company rep and
        record who collected it.
      </p>
      <div className="mt-6">
        <HandoverStation eventId={event.id} />
      </div>
    </div>
  );
}
