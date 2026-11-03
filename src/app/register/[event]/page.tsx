import { notFound } from "next/navigation";
import { isKnownEventSlug } from "@/lib/event-profiles";
import RegisterPageContent from "../RegisterPageContent";

/** Registration form for a specific event, e.g. /register/raigarh-2027 (iframed on that event's site). */
export default async function EventRegisterPage({ params, searchParams }: PageProps<"/register/[event]">) {
  const { event } = await params;
  if (!isKnownEventSlug(event)) notFound();

  const { category } = await searchParams;
  return (
    <RegisterPageContent eventSlug={event} initialCategoryId={typeof category === "string" ? category : undefined} />
  );
}
