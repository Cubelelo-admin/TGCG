import { getAddons, getChildRunnerCategory, getEvent, getTicketCategories } from "@/lib/catalog";
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
          initialCategoryId={category}
        />
      </div>
    </main>
  );
}
