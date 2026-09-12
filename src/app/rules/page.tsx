import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BIB_COLLECTION, CONTACT } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Rules & Regulations — LetsRun TGCG 2026",
  description: "Eligibility, conduct, results, appeals and refund policy for LetsRun TGCG 2026.",
};

export default function RulesPage() {
  return (
    <main className="flex-1">
      <div className="border-b border-[#17181a]/10 bg-[#fbf7ee]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a5a3a]">
            Rules & Regulations
          </div>
          <h1 className="font-display mt-4 text-3xl uppercase tracking-[-0.01em] sm:text-5xl">
            Race conduct & policies
          </h1>
          <p className="mt-4 text-[#6d6656]">
            Every registrant is required to read and accept these rules during registration.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-14 space-y-12 text-[#5c564a]">
        <Rule title="BIB Collection">
          <p>
            BIBs must be collected in person from {BIB_COLLECTION.venue}, during the
            published collection windows. A maximum of 2 race kits may be collected per
            person — your own, plus one authorized other with valid ID proof.
          </p>
        </Rule>

        <Rule title="On the Course">
          <ul className="list-disc space-y-2 pl-5">
            <li>Wear your BIB visibly, unmodified, for the entire race.</li>
            <li>Running under another participant&apos;s BIB results in disqualification.</li>
            <li>No wheeled vehicles (cycles, skates, strollers) or pets are permitted on course.</li>
            <li>Pacers are not permitted.</li>
            <li>Cut-off times are strictly enforced — see Race Information for category-wise cut-offs.</li>
          </ul>
        </Rule>

        <Rule title="Results, Protests & Appeals">
          <p>
            Any protest regarding results must be submitted in writing within 30 minutes of
            results being announced, accompanied by a non-refundable appeal fee of ₹1,000.
            Appeals are responded to within 15 days.
          </p>
        </Rule>

        <Rule title="Prize Money">
          <p>
            Prize money is paid by cheque or bank transfer within 30 working days of
            ratified results, and is subject to applicable TDS. See Race Information for
            eligibility and age-group structure.
          </p>
        </Rule>

        <Rule title="Registration, Refunds & Transfers">
          <p>
            Entries are strictly non-transferable and non-refundable. This applies
            regardless of the reason for a registrant&apos;s inability to participate,
            except for the Comrades Marathon qualifier refund described in Race Information.
          </p>
        </Rule>

        <Rule title="Medical Advisory">
          <p>
            Long-distance running carries inherent physical risk. Participants are advised
            to consult a physician before registering, disclose any relevant medical
            conditions, and stop running immediately if they feel unwell on course. Medical
            and physio support is available along the route and at the finish line.
          </p>
        </Rule>

        <p className="rounded-xl border border-[#17181a]/10 bg-[#fbf7ee] p-5 text-sm">
          This page covers the substantive policies carried over from previous editions. For
          the complete, currently-in-force rules document, or any clarification, contact us
          at{" "}
          <a href={`mailto:${CONTACT.email}`} className="font-medium text-[#2f6f6b] hover:underline">
            {CONTACT.email}
          </a>
          .
        </p>
      </div>
    </main>
  );
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl uppercase tracking-[-0.01em] text-[#17181a]">{title}</h2>
      <div className="mt-3 leading-relaxed">{children}</div>
    </section>
  );
}
