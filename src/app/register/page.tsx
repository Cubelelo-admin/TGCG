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
      <main className="flex min-h-screen flex-1 items-center justify-center bg-white px-6 py-24">
        <p className="text-[#6b7280]">Registration is not open yet.</p>
      </main>
    );
  }

  const [categories, addons] = await Promise.all([
    getTicketCategories(event.id),
    getAddons(event.id),
  ]);

  return (
    <main className="min-h-screen flex-1 bg-white px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="LetsRun" width={64} height={64} className="h-8 w-8" />
          <div>
            <h1 className="text-lg font-bold text-[#111827]">{event.name}</h1>
            <p className="text-sm text-[#6b7280]">
              {new Date(event.event_date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {event.starts_at_text ? ` | ${event.starts_at_text}` : ""}
              {event.venue ? ` | ${event.venue}` : ""}
            </p>
          </div>
        </div>
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
