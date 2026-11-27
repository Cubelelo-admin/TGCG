import Link from "next/link";
import PageHero from "@/site/components/PageHero";
import RegisterCta from "@/site/components/RegisterCta";
import type { EventConfig } from "@/site/content/types";
import { waLink } from "@/site/lib/event";

// The rules that cause the most trouble on race day, shown first as a quick summary.
const keyPoints: { icon: string; en: string; hi: string; needs?: string }[] = [
  { icon: "🚫", en: "Non-refundable & non-transferable", hi: "शुल्क वापस नहीं, ट्रांसफर नहीं" },
  { icon: "🏷️", en: "BIB on the front, chip not folded", hi: "BIB सामने, चिप मोड़ें नहीं" },
  { icon: "⏱️", en: "Runs start on time: no late starts", hi: "दौड़ समय पर शुरू होगी" },
  { icon: "🎧", en: "No headphones recommended", hi: "हेडफ़ोन न लगाएँ" },
  { icon: "🏆", en: "Prizes: competitive only, min. 10 finishers", hi: "पुरस्कार केवल कॉम्पिटिटिव", needs: "prize-money" },
  { icon: "📝", en: "Protests within 30 min · ₹1,000 fee", hi: "आपत्ति 30 मिनट में" },
];

export default function RulesView({ e }: { e: EventConfig }) {
  const rules = e.rules;
  if (!rules) return null;
  const href = (h: string) => (h.startsWith("http") ? h : `${e.basePath}${h}`);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: rules.faq.flatMap((g) =>
      g.items.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: Array.isArray(f.a) ? f.a.join(" ") : f.a },
      })),
    ),
  };

  return (
    <>
      <PageHero eyebrow={`${e.shortName} ${e.edition}`} title="Rules & FAQ" subtitle="Please read before you register and before race day. नियम और सवाल-जवाब।">
        <nav className="jump-links" aria-label="On this page">
          {rules.sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
          <a href="#faq">FAQ</a>
        </nav>
      </PageHero>

      {/* Key points */}
      <section className="section section-tight-top">
        <div className="container">
          <ul className="rules-key reveal">
            {keyPoints.filter((k) => !k.needs || rules.sections.some((s) => s.id === k.needs)).map((k) => (
              <li key={k.en}>
                <span aria-hidden="true">{k.icon}</span>
                <div>
                  <strong>{k.en}</strong>
                  <span className="hi">{k.hi}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Rules sections */}
      <section className="section section-sand">
        <div className="container rules-layout">
          {rules.sections.map((s) => (
            <article key={s.id} id={s.id} className="rules-card reveal">
              <header>
                <h2>{s.title}</h2>
                {s.titleHi && <span className="hi">{s.titleHi}</span>}
                <span className="rules-count">{s.items.length}</span>
              </header>
              {s.intro && <p className="muted">{s.intro}</p>}
              <ol className={`rules-list ${s.items.length > 12 ? "rules-cols" : ""}`}>
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ol>
              {s.id === "prize-money" && e.prizes && (
                <Link href={`${e.basePath}/races#prizes`} className="link">
                  See the prize amounts →
                </Link>
              )}
              {s.id === "bib-collection" && (
                <Link href={`${e.basePath}/race-info#bib`} className="link">
                  BIB collection dates &amp; venue →
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="container narrow">
          <div className="section-head reveal">
            <p className="eyebrow">FAQ · सवाल-जवाब</p>
            <h2>Frequently asked questions</h2>
          </div>
          {rules.faq.map((g) => (
            <div key={g.title} className="faq-group reveal">
              <h3>
                {g.title}
                {g.titleHi && <span className="hi-inline"> · {g.titleHi}</span>}
              </h3>
              {g.items.map((f) => (
                <details key={f.q} className="faq-item">
                  <summary>{f.q}</summary>
                  <div className="faq-a">
                    {Array.isArray(f.a) ? (
                      <ul>
                        {f.a.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{f.a}</p>
                    )}
                    {f.link && (
                      <Link href={href(f.link.href)} className="link">
                        {f.link.label} →
                      </Link>
                    )}
                  </div>
                </details>
              ))}
            </div>
          ))}

          <div className="faq-more reveal">
            <strong>Still have a question?</strong>
            <span className="hi">कोई और सवाल? हमें WhatsApp करें।</span>
            <div className="btn-row">
              <a href={waLink(e, `Hi, I have a question about ${e.shortName} ${e.edition}.`)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                WhatsApp {e.contact.whatsappNumber}
              </a>
              {e.links.raceInfoPdf && (
                <a href={e.links.raceInfoPdf} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  Download PDF
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <RegisterCta e={e} />
    </>
  );
}
