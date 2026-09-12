import type { Metadata } from "next";
import { BIB_COLLECTION, CONTACT, EVENT } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "FAQ — LetsRun TGCG 2026",
  description: "Frequently asked questions about LetsRun TGCG 2026.",
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "When and where is the race?",
    a: `${EVENT.dateLabel}, starting from ${EVENT.venueName}, Raipur, Chhattisgarh.`,
  },
  {
    q: "What is the last date to register?",
    a: `Registrations close on ${EVENT.regDeadlineLabel}, or earlier if a category sells out.`,
  },
  {
    q: "Where and when do I collect my BIB?",
    a: `BIBs are collected in person from ${BIB_COLLECTION.venue}. Collection windows: ${BIB_COLLECTION.windows
      .map((w) => `${w.date} (${w.time})`)
      .join(" and ")}. BIBs are not available on race morning.`,
  },
  {
    q: "Can I run under someone else's BIB, or transfer my entry?",
    a: "No. Entries are non-transferable, and running under another participant's BIB results in disqualification for both parties.",
  },
  {
    q: "Is my entry fee refundable if I can't make it?",
    a: "Entry fees are non-refundable. The one exception is the Comrades Marathon qualifier policy — see Race Information for details.",
  },
  {
    q: "What distances can I choose from?",
    a: "42.195KM Marathon, 21.09KM Half Marathon, 10KM Beginners Delight, and the 6KM Dream Run — full timings and age eligibility are on the Race Information page.",
  },
  {
    q: "Is TGCG a certified course?",
    a: "Yes — the marathon course is AIMS/IAAF and World Athletics measurement-certified, and TGCG is run with RFID chip timing.",
  },
  {
    q: "How do cash prizes work?",
    a: "Cash prizes go to the top 3 finishers in the 42KM, 21KM and 10KM categories, across three age groups, with equal prize money for men and women. Details and eligibility are on the Race Information page.",
  },
  {
    q: "I have a question the FAQ doesn't answer.",
    a: `Reach us at ${CONTACT.email} or WhatsApp ${CONTACT.whatsappDisplay}.`,
  },
];

export default function FaqPage() {
  return (
    <main className="flex-1">
      <div className="border-b border-[#17181a]/10 bg-[#fbf7ee]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a5a3a]">FAQ</div>
          <h1 className="font-display mt-4 text-3xl uppercase tracking-[-0.01em] sm:text-5xl">
            Questions runners ask most
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-14">
        <dl className="divide-y divide-[#17181a]/10">
          {FAQS.map((item) => (
            <div key={item.q} className="py-6">
              <dt className="font-display text-lg uppercase tracking-[-0.01em]">{item.q}</dt>
              <dd className="mt-2 text-[#5c564a] leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}
