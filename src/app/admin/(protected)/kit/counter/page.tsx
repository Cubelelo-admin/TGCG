import { getAdminEvent } from "@/lib/admin-event";
import CounterStation from "./CounterStation";

export default async function KitCounterPage() {
  const { event } = await getAdminEvent();
  if (!event) return <p className="text-neutral-400">No event found.</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Expo counter</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {event.name}. Scan the runner&apos;s pass, check their ID against the last 4 digits, fetch the bag from the shelf
        shown, scan the bag to confirm.
      </p>
      <div className="mt-6">
        <CounterStation eventId={event.id} />
      </div>
    </div>
  );
}
