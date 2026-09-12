import Image from "next/image";
import { getAddons, getEvent, getTicketCategories } from "@/lib/catalog";
import RegisterFlow from "./RegisterFlow";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const event = await getEvent();

  if (!event) {
    return (
      <main className="flex-1 flex items-center justify-center bg-neutral-950 text-neutral-50 px-6 py-24">
        <p className="text-neutral-400">Registration is not open yet.</p>
      </main>
    );
  }

  const [categories, addons] = await Promise.all([
    getTicketCategories(event.id),
    getAddons(event.id),
  ]);

  return (
    <main className="flex-1 bg-neutral-950 text-neutral-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Image src="/logo.png" alt="LetsRun" width={300} height={300} className="h-12 w-12" />
        <h1 className="mt-3 text-3xl font-bold">{event.name}</h1>
        <p className="mt-1 text-neutral-400">
          {event.venue} · {new Date(event.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <RegisterFlow
          categories={categories}
          addons={addons}
          eventName={event.name}
          initialCategoryId={category}
        />
      </div>
    </main>
  );
}
