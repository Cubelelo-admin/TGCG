import { getAddons, getChildRunnerCategory, getEvent, getTicketCategories } from "@/lib/catalog";
import { getEventProfile } from "@/lib/event-profiles";
import RegisterFlow from "./RegisterFlow";

/**
 * The registration form for one event. /register renders TGCG 2026 (the
 * URL already embedded on tgcg.run); /register/[event] renders any other
 * event by slug, e.g. /register/raigarh-2027 for the Raigarh site's iframe.
 */
export default async function RegisterPageContent({
  eventSlug,
  initialCategoryId,
}: {
  eventSlug?: string;
  initialCategoryId?: string;
}) {
  const event = await getEvent(eventSlug);

  if (!event) {
    return (
      <main className="flex items-center justify-center bg-white px-6 py-24">
        <p className="text-[#6b7280]">Registration is not open yet.</p>
      </main>
    );
  }

  const [categories, addons, childCategory] = await Promise.all([
    getTicketCategories(event.id),
    getAddons(event.id),
    getChildRunnerCategory(event.id),
  ]);

  return (
    <main className="bg-white px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <RegisterFlow
          categories={categories}
          addons={addons}
          childCategory={childCategory}
          eventName={event.name}
          eventShortName={getEventProfile(event.slug).shortName}
          initialCategoryId={initialCategoryId}
        />
      </div>
    </main>
  );
}
