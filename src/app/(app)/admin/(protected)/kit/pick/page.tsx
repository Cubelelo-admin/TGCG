import { requireAdmin } from "@/lib/admin-auth";
import { PageHeader } from "@/components/ds";
import PickStation from "./PickStation";

export default async function KitPickPage({ searchParams }: { searchParams: Promise<{ box?: string }> }) {
  await requireAdmin();
  const { box } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Pick & pack"
        subtitle="Scan a box label, then scan every item into it. A BIB only goes into its own runner's box. The box turns Ready by itself when the last item is in."
      />
      <PickStation initialBox={box} />
    </div>
  );
}
