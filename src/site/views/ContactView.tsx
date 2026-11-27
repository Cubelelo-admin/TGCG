import InstagramSection from "@/site/components/InstagramSection";
import PageHero from "@/site/components/PageHero";
import { organiser } from "@/site/content/organiser";
import type { EventConfig } from "@/site/content/types";
import { waLink } from "@/site/lib/event";

export default function ContactView({ e }: { e: EventConfig }) {
  return (
    <>
      <PageHero
        eyebrow={e.shortName}
        title="Contact"
        subtitle={`Questions about registration, BIBs or race day in ${e.city}? Reach the LetsRun team.`}
      />

      <section className="section">
        <div className="container info-grid">
          <a
            href={waLink(e, `Hi, I have a question about ${e.shortName} ${e.edition}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="info-card contact-card contact-wa reveal"
          >
            <h3>WhatsApp helpline</h3>
            <p className="big">{e.contact.whatsappNumber}</p>
            <span className="link">Chat now ↗</span>
          </a>
          <a href={`mailto:${e.contact.email}`} className="info-card contact-card reveal">
            <h3>Email</h3>
            <p className="big">{e.contact.email}</p>
            <span className="link">Write to us ↗</span>
          </a>
          <div className="info-card reveal">
            <h3>Follow</h3>
            <ul className="plain">
              {e.socials.map((s) => (
                <li key={s.name}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="link">
                    {s.name} · {s.handle} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <InstagramSection e={e} />

      <section className="section">
        <div className="container">
          <p className="muted center">
            Event by {organiser.name}, {organiser.address} · {organiser.legalName} · CIN: {organiser.cin}
          </p>
        </div>
      </section>
    </>
  );
}
