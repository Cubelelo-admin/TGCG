import PickStation from "./PickStation";

export default async function KitPickPage({ searchParams }: { searchParams: Promise<{ box?: string }> }) {
  const { box } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Pick &amp; pack</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Scan a box label, then scan every item into it. A BIB only goes into its own runner&apos;s box. The box turns
        Ready by itself when the last item is in.
      </p>
      <div className="mt-6">
        <PickStation initialBox={box} />
      </div>
    </div>
  );
}
