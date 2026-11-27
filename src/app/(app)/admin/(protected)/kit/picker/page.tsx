import { requireAdmin } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import { Card, EmptyState, PageHeader } from "@/components/ds";
import PickerStation from "./PickerStation";

export default async function KitPickerPage() {
  // Admins testing; volunteers use the same screen in the volunteer app (/v).
  await requireAdmin();
  const { event } = await getAdminEvent();
  if (!event) {
    return (
      <div>
        <PageHeader title="Picker" />
        <Card>
          <EmptyState title="No active event found." />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <PickerStation eventId={event.id} />
    </div>
  );
}
