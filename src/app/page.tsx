import Image from "next/image";
import Link from "next/link";
import { getEvent, getTicketCategories } from "@/lib/catalog";

export default async function HomePage() {
  const event = await getEvent();
  const categories = event ? await getTicketCategories(event.id) : [];

  const eventDate = event
    ? new Date(event.event_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const competitive = categories.filter((c) => c.group === "competitive");
  const nonCompetitive = categories.filter((c) => c.group === "non_competitive");

  return (
    <main className="flex-1 bg-neutral-950 text-neutral-50">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-emerald-900 via-neutral-950 to-neutral-950">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28 text-center">
          <Image
            src="/logo.png"
            alt="LetsRun"
            width={300}
            height={300}
            priority
            className="mx-auto h-20 w-20 sm:h-24 sm:w-24"
          />
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Let&apos;s Run presents
          </p>
          <h1 className="mt-4 text-4xl sm:text-6xl font-extrabold tracking-tight">
            {event?.name ?? "LetsRun TGCG 2026"}
          </h1>
          {event?.description && (
            <p className="mt-5 text-lg text-neutral-300 max-w-2xl mx-auto">
              {event.description}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-neutral-200">
            {eventDate && (
              <span className="inline-flex items-center gap-2">
                <CalendarIcon /> {eventDate}
                {event?.starts_at_text ? ` · ${event.starts_at_text}` : ""}
              </span>
            )}
            {event?.venue && (
              <span className="inline-flex items-center gap-2">
                <PinIcon /> {event.venue}
              </span>
            )}
          </div>
          <div className="mt-10">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-neutral-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Register Now
            </Link>
          </div>
        </div>
      </section>

      {/* Ticket categories */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        {competitive.length > 0 && (
          <TicketGroup
            title="Competitive Categories"
            subtitle="नकद पुरस्कार श्रेणी — compete for cash prizes"
            categories={competitive}
          />
        )}
        {nonCompetitive.length > 0 && (
          <TicketGroup
            title="Non-Competitive Categories"
            subtitle="Run for the experience, fitness, and joy of running"
            categories={nonCompetitive}
            className="mt-14"
          />
        )}
        {categories.length === 0 && (
          <p className="text-center text-neutral-400">
            Ticket categories will be published here shortly.
          </p>
        )}
      </section>
    </main>
  );
}

function TicketGroup({
  title,
  subtitle,
  categories,
  className = "",
}: {
  title: string;
  subtitle: string;
  categories: Awaited<ReturnType<typeof getTicketCategories>>;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-sm text-neutral-400 mt-1">{subtitle}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/register?category=${c.id}`}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-emerald-400/50 hover:bg-white/[0.06]"
          >
            <h3 className="font-semibold text-lg">{c.name}</h3>
            <p className="mt-2 text-2xl font-bold text-emerald-400">
              ₹{Number(c.price_inr).toLocaleString("en-IN")}
            </p>
            {c.min_age && (
              <p className="mt-1 text-xs text-neutral-400">
                Age eligibility: {c.min_age}+ years
              </p>
            )}
            <span className="mt-4 inline-block text-sm font-medium text-emerald-400 group-hover:underline">
              Register &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
