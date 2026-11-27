import Image from "next/image";
import Link from "next/link";
import Bi from "@/site/components/Bi";
import DaysChip from "@/site/components/DaysChip";
import RevealObserver from "@/site/components/RevealObserver";
import { events } from "@/site/content/events";
import { organiser } from "@/site/content/organiser";
import { registrationStatus, waLink } from "@/site/lib/event";

// Event chooser — the first thing runners see. Each card leads into a fully separate event section.
// All text is shown in English and Hindi together.
export default function ChooseEvent() {
  return (
    <div className="chooser">
      <main>
        <header className="chooser-head container reveal">
          <Image src="/shared/letsrun-logo.png" alt="LetsRun" width={72} height={72} className="chooser-logo" priority />
          <p className="eyebrow">
            The Great Chhattisgarh Run <span className="hi-inline" style={{ whiteSpace: "nowrap" }}>· द ग्रेट छत्तीसगढ़ रन</span>
          </p>
          <h1>
            Choose your run
            <span className="hi chooser-h1-hi">अपनी दौड़ चुनें</span>
          </h1>
          <p className="lead">
            Pick the event you want to register for.
            <span className="hi">जिस दौड़ के लिए पंजीकरण करना है, उसे चुनें।</span>
          </p>
        </header>

        <div className="container chooser-grid">
          {events.map((e, i) => {
            const status = registrationStatus(e);
            const canRegister = status === "open";
            return (
              <article
                key={e.slug}
                className="event-card reveal"
                data-event={e.slug}
                style={{ "--delay": `${i * 120}ms` } as React.CSSProperties}
              >
                <Link href={e.basePath} className="event-card-media" tabIndex={-1} aria-hidden="true">
                  {e.images?.card ? (
                    <Image src={e.images.card} alt="" fill sizes="(max-width: 700px) 100vw, 500px" className="event-card-img" />
                  ) : (
                    <span className="event-card-art" />
                  )}
                  <span className="event-card-chip">
                    <DaysChip to={e.date} mode="race" />
                  </span>
                </Link>
                <div className="event-card-top">
                  <span className="event-city">
                    <Bi en={e.city} hi={e.cityHi} />
                  </span>
                  <h2>
                    <Link href={e.basePath} className="stretched">
                      {e.shortName}
                    </Link>
                  </h2>
                  <p className="event-name">
                    {e.name} {e.edition}
                  </p>
                </div>
                <dl className="event-facts">
                  <div>
                    <dt>
                      <Bi en="Date" hi="तारीख" stack />
                    </dt>
                    <dd>
                      <Bi en={e.dateLabel} hi={e.dateLabelHi} stack />
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Bi en="Venue" hi="स्थान" stack />
                    </dt>
                    <dd>
                      <Bi en={e.venue.name} hi={e.venue.nameHi} stack />
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Bi en="Races" hi="दौड़" stack />
                    </dt>
                    <dd>
                      {e.races.length ? (
                        e.races.map((r) => r.distance.replace(".195", "").replace(".097", "")).join(" · ")
                      ) : (
                        <Bi en="Announcing soon" hi="जल्द घोषणा" stack />
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="event-actions">
                  {canRegister ? (
                    <Link href={`${e.basePath}/register`} className="btn btn-primary">
                      <Bi en={`Register for ${e.city}`} hi="पंजीकरण करें" stack />
                    </Link>
                  ) : status === "closed" ? (
                    <Link href={`${e.basePath}/race-day`} className="btn btn-primary">
                      <Bi en="Race day guide" hi="रेस डे गाइड" stack />
                    </Link>
                  ) : (
                    <a
                      href={waLink(e, `Hi, please notify me when registration for ${e.shortName} ${e.edition} opens.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                    >
                      <Bi en="Notify me" hi="सूचना पाएँ" stack />
                    </a>
                  )}
                  <Link href={e.basePath} className="btn btn-ghost">
                    <Bi en="Explore event →" hi="इवेंट देखें" stack />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      <footer className="chooser-foot container">
        <Bi en={`Organised by ${organiser.name}`} hi="आयोजक: लेट्सरन टीम" /> ·{" "}
        <a href={organiser.whatsappUrl}>WhatsApp {organiser.whatsappNumber}</a> ·{" "}
        <a href={`mailto:${organiser.email}`}>{organiser.email}</a> ·{" "}
        <Link href="/policies">
          <Bi en="Terms, privacy & refunds" hi="नियम व नीतियाँ" />
        </Link>
      </footer>
      <RevealObserver />
    </div>
  );
}
