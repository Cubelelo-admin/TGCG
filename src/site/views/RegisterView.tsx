import Link from "next/link";
import Bi from "@/site/components/Bi";
import DaysChip from "@/site/components/DaysChip";
import PageHero from "@/site/components/PageHero";
import RegisterFrame from "@/site/components/RegisterFrame";
import type { EventConfig } from "@/site/content/types";
import { inr, registrationStatus, waLink } from "@/site/lib/event";

export default function RegisterView({ e, extraLinks = [] }: { e: EventConfig; extraLinks?: { href: string; label: string }[] }) {
  const status = registrationStatus(e);
  const url = status === "open" ? e.links.register : undefined;

  return (
    <>
      <PageHero
        eyebrow={`${e.shortName} ${e.edition} · ${e.dateLabel}`}
        title="Registration / पंजीकरण"
        subtitle={url ? "Fill in the form below to register. पंजीकरण के लिए नीचे प्रपत्र भरें।" : undefined}
      >
        {e.registrationDeadline && (
          <p className="deadline">
            Last day to register: <strong>{e.registrationDeadline}</strong>
            {e.registrationDeadlineHi && <span className="hi"> · {e.registrationDeadlineHi}</span>}
          </p>
        )}
        {e.registrationDeadlineDate && (
          <div className="hero-chip">
            <DaysChip to={e.registrationDeadlineDate} mode="deadline" />
          </div>
        )}
      </PageHero>

      <section className="section">
        <div className="container narrow">
          {url ? (
            <>
              {e.fees.length > 0 && (
                <div className="register-summary">
                  {e.fees.map((f) => (
                    <div key={f.title}>
                      <span className="meta-label">{f.title}</span>
                      <strong>
                        {inr(f.price)}
                        {f.tax && <small className="price-tax"> {f.tax}</small>}
                      </strong>
                      <span className="small">{f.badge}</span>
                    </div>
                  ))}
                  <Link href={`${e.basePath}/races#fees`} className="link">
                    Compare categories
                  </Link>
                </div>
              )}
              <RegisterFrame src={url} title={`${e.shortName} registration`} />
              <div className="register-help">
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-dark">
                  Form not loading? Open the registration page ↗
                </a>
                <a href={waLink(e, `Hi, I need help registering for ${e.shortName} ${e.edition}.`)} target="_blank" rel="noopener noreferrer" className="link">
                  <Bi en="Need help? WhatsApp us" hi="मदद चाहिए?" />
                </a>
                <Link href={`${e.basePath}/${e.rules ? "rules" : "race-info"}`} className="link">
                  Read the rules &amp; FAQ first
                </Link>
                {extraLinks.map((l) => (
                  <Link key={l.href} href={`${e.basePath}${l.href}`} className="link">
                    {l.label}
                  </Link>
                ))}
              </div>
            </>
          ) : status === "closed" ? (
            <div className="coming-soon">
              <span className="coming-soon-icon" aria-hidden="true">🏁</span>
              <strong>Registration for {e.shortName} {e.edition} is closed.</strong>
              <span className="hi">पंजीकरण बंद हो चुका है।</span>
              <p>Already registered? Everything you need for race morning is in the race-day guide.</p>
              <Link href={`${e.basePath}/race-day`} className="btn btn-primary">
                Race day guide
              </Link>
              <a
                href={waLink(e, `Hi, I have a question about ${e.shortName} ${e.edition}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                <Bi en="Questions? WhatsApp us" hi="सवाल?" />
              </a>
            </div>
          ) : (
            <div className="coming-soon">
              <span className="coming-soon-icon" aria-hidden="true">⏳</span>
              <strong>Registration for {e.shortName} opens soon.</strong>
              <span className="hi">पंजीकरण जल्द ही शुरू होगा।</span>
              <a
                href={waLink(e, `Hi, please notify me when registration for ${e.shortName} ${e.edition} opens.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Get notified on WhatsApp
              </a>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
