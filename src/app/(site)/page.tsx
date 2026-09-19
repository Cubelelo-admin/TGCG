import Image from "next/image";
import Link from "next/link";
import { getEvent, getTicketCategories } from "@/lib/catalog";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { EVENT } from "@/lib/site-content";
import type { TicketCategory } from "@/lib/types";

export default async function HomePage() {
  const event = await getEvent();
  const categories = event ? await getTicketCategories(event.id) : [];
  const competitive = categories.filter((c) => c.group === "competitive");
  const nonCompetitive = categories.filter((c) => c.group === "non_competitive");
  const nonCompetitiveFrom = nonCompetitive.length
    ? Math.min(...nonCompetitive.map((c) => Number(c.price_inr)))
    : null;

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-5xl px-6 pt-10 text-center sm:pt-16">
          <h1 className="flex justify-center">
            <span className="sr-only">The Great Chhattisgarh Run</span>
            <Image
              src="/tgcg-logo-full.png"
              alt="HIRA — The Great Chhattisgarh Run"
              width={1891}
              height={844}
              priority
              className="h-auto w-full max-w-[520px] sm:max-w-[680px] lg:max-w-[860px]"
            />
          </h1>

          <p className="mx-auto mt-8 max-w-xl text-lg font-medium text-[#5c564a]">
            {event?.name ?? EVENT.shortName} · {EVENT.edition} — {EVENT.dateLabel}, {EVENT.venueName},
            Raipur. {EVENT.theme}.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <PrimaryButton href="/register" size="lg">
              Register Now
            </PrimaryButton>
            <SecondaryButton href="/race-information" size="lg">
              Race Information
            </SecondaryButton>
          </div>

          <div className="relative z-10 mt-16 h-[3px] w-full bg-gradient-to-r from-transparent via-[#b9541f] to-transparent" />
        </div>
      </section>

      {/* Ticket categories */}
      <section className="mx-auto max-w-5xl px-6 pt-10 pb-20">
        {competitive.length > 0 && (
          <TicketList
            title="Competitive Categories"
            subtitle="Cash prizes for top 3, all age groups"
            categories={competitive}
          />
        )}

        {nonCompetitiveFrom !== null && (
          <p className="mt-5 text-sm text-[#6d6656]">
            Non-competitive entries also open, from ₹{nonCompetitiveFrom.toLocaleString("en-IN")} ·{" "}
            {nonCompetitive.map((c) => c.name).join(" · ")}
          </p>
        )}

        {categories.length === 0 && (
          <p className="text-center text-[#6d6656]">
            Ticket categories will be published here shortly.
          </p>
        )}
      </section>

      {/* Explore links */}
      <section className="border-t border-[#17181a]/10 bg-[#fbf7ee]">
        <div className="mx-auto max-w-5xl px-6 py-16 grid gap-4 sm:grid-cols-3">
          <ExploreCard
            href="/gallery"
            title="Gallery"
            description="Relive past editions — recap films and race-day photos."
          />
          <ExploreCard
            href="/rules"
            title="Rules & Regulations"
            description="Eligibility, BIB collection, cut-offs, and prize policy."
          />
          <ExploreCard
            href="/faq"
            title="FAQ"
            description="Answers to the questions runners ask most."
          />
        </div>
      </section>
    </main>
  );
}

function TicketList({
  title,
  subtitle,
  categories,
}: {
  title: string;
  subtitle: string;
  categories: TicketCategory[];
}) {
  return (
    <div>
      <h2 className="font-display text-2xl uppercase tracking-[-0.01em]">{title}</h2>
      <p className="mt-1 text-sm text-[#6d6656]">{subtitle}</p>
      <div className="mt-6 flex flex-col">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/register?category=${c.id}`}
            className="group flex items-baseline justify-between gap-4 border-b-2 border-[#17181a] py-5"
          >
            <div className="font-semibold text-lg">{c.name}</div>
            <div className="hidden flex-1 text-sm text-[#6d6656] sm:block">
              {c.min_age ? `Age eligibility: ${c.min_age}+ years` : c.description}
            </div>
            <div className="font-display shrink-0 text-2xl text-[#b9541f] group-hover:underline">
              ₹{Number(c.price_inr).toLocaleString("en-IN")}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ExploreCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#17181a]/10 bg-[#f6ede1] p-6 transition hover:border-[#2f6f6b]/40"
    >
      <h3 className="font-display text-lg uppercase tracking-[-0.01em]">{title}</h3>
      <p className="mt-2 text-sm text-[#6d6656]">{description}</p>
      <span className="mt-4 inline-block text-sm font-medium text-[#2f6f6b] group-hover:underline">
        Explore &rarr;
      </span>
    </Link>
  );
}
