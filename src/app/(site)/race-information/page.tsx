import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PrimaryButton } from "@/components/Buttons";
import { BIB_COLLECTION, DISTANCES, EVENT, WHATS_INCLUDED } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Race Information — LetsRun TGCG 2026",
  description:
    "Distances, timings, cut-offs, BIB collection, and what's included at LetsRun TGCG 2026.",
};

export default function RaceInformationPage() {
  return (
    <main className="flex-1">
      <PageHeader
        eyebrow="Race Information"
        title="Everything you need to know before race day"
        subtitle={`${EVENT.dateLabel} · ${EVENT.venueName}, Raipur · ${EVENT.certification}`}
      />

      <Section title="Distances">
        <div className="grid gap-4 sm:grid-cols-2">
          {DISTANCES.map((d) => (
            <div key={d.key} className="rounded-2xl border border-[#17181a]/10 bg-[#fbf7ee] p-6">
              <h3 className="font-display text-lg uppercase tracking-[-0.01em]">{d.label}</h3>
              <p className="mt-1 text-sm text-[#6d6656]">Age eligibility: {d.minAge}+ years</p>
              <a
                href={d.routeUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium text-[#2f6f6b] hover:underline"
              >
                View route map &rarr;
              </a>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Race Timings" tint>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-[#17181a] text-left">
                <th className="py-3 pr-4 font-semibold">Category</th>
                <th className="py-3 pr-4 font-semibold">Assemble</th>
                <th className="py-3 pr-4 font-semibold">Warm-up</th>
                <th className="py-3 pr-4 font-semibold">Start</th>
                <th className="py-3 pr-4 font-semibold">Cut-off</th>
                <th className="py-3 font-semibold">End by</th>
              </tr>
            </thead>
            <tbody>
              {DISTANCES.map((d) => (
                <tr key={d.key} className="border-b border-[#17181a]/10">
                  <td className="py-3 pr-4 font-medium">{d.label}</td>
                  <td className="py-3 pr-4 text-[#6d6656]">{d.assemble}</td>
                  <td className="py-3 pr-4 text-[#6d6656]">{d.warmup}</td>
                  <td className="py-3 pr-4 text-[#6d6656]">{d.start}</td>
                  <td className="py-3 pr-4 text-[#6d6656]">{d.cutoff}</td>
                  <td className="py-3 text-[#6d6656]">{d.endBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Prize Money">
        <p className="max-w-2xl text-[#5c564a]">
          Cash prizes are awarded for 1st, 2nd and 3rd place in the 42KM, 21KM and 10KM
          categories only (not the 6KM Dream Run), across three age groups — Open (minimum
          race age–34), 35–45, and 46+. Prize money is equal for men and women in every age
          group. A minimum of 10 finishers is required in a category for prizes to be
          awarded there.
        </p>
        <p className="mt-4 max-w-2xl rounded-xl border border-[#b9541f]/30 bg-[#b9541f]/5 p-4 text-sm text-[#6d6656]">
          Exact prize amounts for the 2026 edition will be published here once confirmed by
          the organizer — contact us if you need them sooner.
        </p>
      </Section>

      <Section title="What's Included" tint>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WHATS_INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-[#5c564a]">
              <CheckIcon />
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="BIB Collection">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm text-[#6d6656]">Venue</p>
            <p className="mt-1 font-medium">{BIB_COLLECTION.venue}</p>
            <a
              href={BIB_COLLECTION.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-medium text-[#2f6f6b] hover:underline"
            >
              View on map &rarr;
            </a>
          </div>
          <div>
            <p className="text-sm text-[#6d6656]">Collection windows</p>
            <ul className="mt-1 space-y-1">
              {BIB_COLLECTION.windows.map((w) => (
                <li key={w.date} className="font-medium">
                  {w.date} · {w.time}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-6 text-sm text-[#6d6656]">
          Maximum 2 race kits collectible per person — for yourself and one authorized other,
          with ID proof.
        </p>
      </Section>

      <Section title="Comrades Marathon Qualifier" tint>
        <p className="max-w-2xl text-[#5c564a]">
          TGCG&apos;s marathon course has been World Athletics measurement-certified since
          2019, making it one of India&apos;s best courses for qualifying times ahead of the
          Comrades Marathon in South Africa. Runners who register for TGCG and later show
          proof of their Comrades Marathon registration get their TGCG entry fee refunded in
          full.
        </p>
      </Section>

      <div className="mx-auto max-w-5xl px-6 pb-24 text-center">
        <PrimaryButton href="/register" size="lg">
          Register Now
        </PrimaryButton>
      </div>
    </main>
  );
}

function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="border-b border-[#17181a]/10 bg-[#fbf7ee]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a5a3a]">
          {eyebrow}
        </div>
        <h1 className="font-display mt-4 text-3xl uppercase tracking-[-0.01em] sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-[#6d6656]">{subtitle}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  tint = false,
}: {
  title: string;
  children: ReactNode;
  tint?: boolean;
}) {
  return (
    <section className={tint ? "bg-[#fbf7ee]" : ""}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="font-display text-2xl uppercase tracking-[-0.01em]">{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2f6f6b"
      strokeWidth="2.5"
      className="mt-0.5 shrink-0"
    >
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}
