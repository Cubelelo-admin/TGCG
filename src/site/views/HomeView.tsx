import Image from "next/image";
import Link from "next/link";
import AddToCalendar from "@/site/components/AddToCalendar";
import Bi from "@/site/components/Bi";
import Countdown from "@/site/components/Countdown";
import DaysChip from "@/site/components/DaysChip";
import InstagramSection from "@/site/components/InstagramSection";
import RaceCards from "@/site/components/RaceCards";
import RegisterCta from "@/site/components/RegisterCta";
import Sponsors from "@/site/components/Sponsors";
import StatNumber from "@/site/components/StatNumber";
import Testimonials from "@/site/components/Testimonials";
import YouTube from "@/site/components/YouTube";
import type { EventConfig } from "@/site/content/types";
import { raceWindow, racePrices, registrationStatus, waLink } from "@/site/lib/event";
import CoursePreview from "@/site/components/CoursePreview";
import EventJsonLd from "@/site/components/EventJsonLd";

export default function HomeView({ e }: { e: EventConfig }) {
  const gallery = e.galleryImages ?? [];
  const heroPhoto = e.images?.hero;
  const status = registrationStatus(e);
  const canRegister = status === "open";
  const raceEnd = new Date(raceWindow(e).end).toISOString();
  const notify = waLink(e, `Hi, please notify me when registration for ${e.shortName} ${e.edition} opens.`);

  return (
    <>
      <EventJsonLd e={e} />
      {/* ---------- Hero ---------- */}
      <section className={`hero ${heroPhoto ? "hero-photo" : "hero-art"}`}>
        {heroPhoto && (
          <Image src={heroPhoto} alt="" fill priority sizes="100vw" className="hero-bg" />
        )}
        <div className={`container hero-grid ${e.videos?.hero ? "" : "hero-single"}`}>
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow">
              Edition {e.edition}
              {e.cause ? ` · ${e.cause}` : ""}
            </p>
            {e.logo ? (
              <>
                <h1 className="sr-only">{e.name}</h1>
                <Image src={e.logo.src} alt={e.name} width={e.logo.width} height={e.logo.height} priority className="hero-logo" />
              </>
            ) : (
              <h1 className="hero-title">
                The Great Chhattisgarh Run
                <span>{e.city}</span>
              </h1>
            )}
            {e.tagline && <p className="hero-tagline">{e.tagline}</p>}
            <div className="hero-meta">
              <div>
                <span className="meta-label">Race day</span>
                <strong>{e.dateLabel}</strong>
                {e.dateLabelHi && <span className="hi">{e.dateLabelHi}</span>}
              </div>
              <div>
                <span className="meta-label">Venue</span>
                <strong>{e.venue.name}</strong>
                <span>{e.venue.detail}</span>
              </div>
            </div>
            <Countdown to={e.date} end={raceEnd} resultsHref={`${e.basePath}/results`} />
            {canRegister && e.registrationDeadline && (
              <p className="reg-closes">
                <span aria-hidden="true">📅</span>
                <span>
                  Registration closes <strong>{e.registrationDeadline}</strong>
                  {e.registrationDeadlineHi && <span className="hi">{e.registrationDeadlineHi}</span>}
                </span>
              </p>
            )}
            {canRegister && e.registrationDeadlineDate && (
              <div className="hero-chip">
                <DaysChip to={e.registrationDeadlineDate} mode="deadline" />
              </div>
            )}
            <div className="hero-actions">
              {canRegister ? (
                <Link href={`${e.basePath}/register`} className="btn btn-primary btn-lg">
                  <Bi en="Register now" hi="पंजीकरण" />
                </Link>
              ) : status === "closed" ? (
                <Link href={`${e.basePath}/race-day`} className="btn btn-primary btn-lg">
                  <Bi en="Race day guide" hi="रेस डे गाइड" />
                </Link>
              ) : (
                <a href={notify} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
                  <Bi en="Notify me on WhatsApp" hi="सूचना पाएँ" />
                </a>
              )}
              <Link href={`${e.basePath}/race-info`} className="btn btn-ghost btn-lg">
                <Bi en="Race information" hi="जानकारी" />
              </Link>
            </div>
            <AddToCalendar e={e} className="hero-cal" />
          </div>
          {e.videos?.hero && (
            <div className="hero-video">
              <YouTube id={e.videos.hero} title={e.shortName} vertical />
            </div>
          )}
        </div>
        <div className="waves waves-bottom" aria-hidden="true" />
      </section>

      {/* ---------- Races ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow">Choose your distance</p>
            <h2>{e.races.length ? `${e.races.length} races. One river of runners.` : "Race categories"}</h2>
            {e.races.length > 0 && (
              <p className="muted">
                {canRegister
                  ? "Tap a race to register. दौड़ चुनें और पंजीकरण करें।"
                  : "Tap a race for its timings, fees and route. समय, शुल्क और रूट के लिए दौड़ चुनें।"}
              </p>
            )}
          </div>
          <RaceCards races={e.races} basePath={e.basePath} canRegister={canRegister} prices={racePrices(e)} />
          {e.races.length > 0 && (
            <div className="center mt">
              <Link href={`${e.basePath}/races`} className="btn btn-dark">
                Schedule, fees{e.prizes ? ", prizes" : ""} &amp; routes →
              </Link>
            </div>
          )}
        </div>
      </section>

      <CoursePreview e={e} />

      {/* ---------- Highlight + stats ---------- */}
      {(e.highlight || (e.stats && e.stats.length > 0)) && (
        <section className="section section-navy section-texture">
          <div className={`container ${e.highlight ? "split" : ""}`}>
            {e.highlight && (
              <div className="reveal">
                <p className="eyebrow">{e.highlight.eyebrow}</p>
                <h2>{e.highlight.title}</h2>
                <ul className="check-list">
                  {e.highlight.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <Link href={`${e.basePath}${e.highlight.href}`} className="btn btn-accent">
                  {e.highlight.cta}
                </Link>
              </div>
            )}
            {e.stats && e.stats.length > 0 && (
              <div className="stat-grid">
                {e.stats.map((s, i) => (
                  <div key={s.label} className="stat reveal" style={{ "--delay": `${i * 80}ms` } as React.CSSProperties}>
                    <StatNumber stat={s} />
                    <span>
                      <Bi en={s.label} hi={s.labelHi} stack />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------- Training program (same spot as on tgcg.run) ---------- */}
      <section className="section">
        <div className={`container ${e.training?.video ? "split" : "narrow center"}`}>
          {e.training?.video && <YouTube id={e.training.video} title={`${e.shortName} training program`} vertical />}
          <div className="reveal">
            <p className="eyebrow">Free and effective</p>
            <h2>Join the {e.shortName} training program</h2>
            <p className="lead">
              {e.training?.intro ?? `Training sessions for ${e.city} runners will be announced soon.`}
              <span className="hi">मुफ़्त ट्रेनिंग प्रोग्राम से जुड़ें।</span>
            </p>
            <Link href={`${e.basePath}/training`} className="btn btn-dark">
              <Bi en="Join training" hi="ट्रेनिंग" />
            </Link>
          </div>
        </div>
      </section>

      {/* "Previous editions / Memories from the road" photo strip removed on request; the gallery page is still in the menu. */}

      <InstagramSection e={e} photos={gallery} />

      {/* ---------- Medal (real medal photo) ---------- */}
      {e.images?.medal && (
        <section className="section medal-section">
          <div className="container split">
            <div className="medal-stage reveal">
              <Image src={e.images.medal} alt="Finisher medal" width={768} height={960} className="medal-img" />
            </div>
            <div className="reveal">
              <p className="eyebrow">Earn it</p>
              <h2>Your {e.edition} finisher medal</h2>
              <p className="lead">Every finisher, every distance. Cross the line and it&apos;s yours.</p>
              {canRegister && (
                <Link href={`${e.basePath}/register`} className="btn btn-primary">
                  Run for it
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ---------- Facilities ---------- */}
      {e.images?.facilities && (
        <section className="section">
          <div className="container split">
            <Image
              src={e.images.facilities}
              alt="Facilities for all participants"
              width={768}
              height={1152}
              className="rounded shadow reveal"
            />
            <div className="reveal">
              <p className="eyebrow">Every runner gets</p>
              <h2>Medal, chip timing, dry&#8209;fit tee &amp; hot breakfast</h2>
              <p className="lead">
                Every category includes a finisher medal, a chip-timed BIB, a dry-fit T-shirt, a bag, a bottle, warm-up
                Zumba, physio support and a globally recognised online timing certificate.
              </p>
              <Link href={`${e.basePath}/race-info#facilities`} className="btn btn-dark">
                See all facilities
              </Link>
            </div>
          </div>
        </section>
      )}

      <Testimonials items={e.testimonials} />

      {/* ---------- Coming soon: notify ---------- */}
      {status === "soon" && (
        <section className="section section-sand">
          <div className="container narrow center reveal">
            <p className="eyebrow">Be the first to know</p>
            <h2>Registration for {e.city} opens soon</h2>
            <p className="lead">
              {e.races.length
                ? "Get a WhatsApp message the moment registration opens."
                : "Get a WhatsApp message the moment registration opens, along with race categories, route and fees."}
              <span className="hi">पंजीकरण शुरू होते ही WhatsApp पर सूचना पाएँ।</span>
            </p>
            <a href={notify} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
              Notify me on WhatsApp
            </a>
          </div>
        </section>
      )}

      <Sponsors e={e} />

      {/* ---------- Contacts (closes the page, as on tgcg.run) ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow">Contacts · संपर्क</p>
            <h2>Questions? Talk to the LetsRun team</h2>
          </div>
          <div className="info-grid">
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
          </div>
        </div>
      </section>

      <RegisterCta e={e} />
    </>
  );
}
