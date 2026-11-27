import Image from "next/image";
import Link from "next/link";
import PageHero from "@/site/components/PageHero";
import RegisterCta from "@/site/components/RegisterCta";
import FacilityIcon from "@/site/components/FacilityIcon";
import VenueMap,{ directionsUrl, hasVenueMap } from "@/site/components/VenueMap";
import type { EventConfig } from "@/site/content/types";
import { allDayCalendarUrl, googleCalendarUrl, isPlaceholderTime, SITE_URL } from "@/site/lib/event";

export default function RaceInfoView({ e }: { e: EventConfig }) {
  const hasMap = hasVenueMap(e);
  const routes = e.races.filter((r) => r.routeUrl);
  const timed = e.races.filter((r) => r.start);
  const where = `${e.venue.name}, ${e.venue.detail}`;

  // Key dates strip: registration deadline → BIB collection → race day, each with an add-to-calendar link
  const keyDates: { label: string; labelHi: string; day: string; sub?: string; cal: string | null; tone?: string }[] = [];
  if (e.registrationDeadline && e.links.register) {
    keyDates.push({
      label: "Registration closes",
      labelHi: "अंतिम पंजीकरण",
      day: e.registrationDeadline,
      cal: allDayCalendarUrl(`${e.shortName}: registration closes`, new Date(e.registrationDeadlineDate ?? e.registrationDeadline), `${SITE_URL}${e.basePath}/register`),
      tone: "warn",
    });
  }
  e.bibCollection?.slots.forEach((s) =>
    keyDates.push({
      label: "BIB collection",
      labelHi: "बिब कलेक्शन",
      day: s.day,
      sub: s.time,
      cal: allDayCalendarUrl(`${e.shortName}: BIB collection${isPlaceholderTime(s.time) ? "" : ` (${s.time})`}`, s.day, `${SITE_URL}${e.basePath}/race-info#bib`, e.bibCollection!.venue),
    }),
  );
  keyDates.push({ label: "Race day", labelHi: "रेस डे", day: e.dateLabel, sub: timed[0]?.start ? `First flag-off ${timed[0].start}` : undefined, cal: googleCalendarUrl(e, SITE_URL), tone: "race" });

  const jump = [
    ["#dates", "Key dates"],
    ...(timed.length ? [["#timings", "Timings"]] : []),
    ["#bib", "BIB collection"],
    ["#course", "Course"],
    ...(e.rules ? [["#rules", "Rules & FAQ"]] : []),
    ...(e.facilities ? [["#facilities", "Facilities"]] : []),
    ["#venue", "Venue"],
    ...(e.hotels ? [["#stay", "Stay"]] : []),
  ];

  return (
    <>
      <PageHero
        eyebrow={e.dateLabel}
        title="Race information"
        subtitle="Timings, rules, FAQ and everything you need on race weekend. दौड़ की सभी जानकारी।"
      >
        <nav className="jump-links" aria-label="On this page">
          {jump.map(([h, l]) => (
            <a key={h} href={h}>
              {l}
            </a>
          ))}
        </nav>
        <div className="hero-actions">
          {e.rules && (
            <Link href={`${e.basePath}/rules`} className="btn btn-primary">
              Rules &amp; FAQ
            </Link>
          )}
          {e.links.raceInfoPdf && (
            <a href={e.links.raceInfoPdf} target="_blank" rel="noopener noreferrer" className={`btn ${e.rules ? "btn-ghost" : "btn-primary"}`}>
              Download PDF
            </a>
          )}
          <Link href={`${e.basePath}/race-day`} className="btn btn-ghost">
            Race-day guide
          </Link>
        </div>
      </PageHero>

      {/* Key dates */}
      <section className="section section-tight-top" id="dates">
        <div className="container">
          <ol className="key-dates reveal">
            {keyDates.map((k) => (
              <li key={k.label + k.day} className={k.tone ? `kd-${k.tone}` : undefined}>
                <span className="kd-label">
                  {k.label} <span className="hi-inline">· {k.labelHi}</span>
                </span>
                <strong>{k.day}</strong>
                {k.sub && <span className="kd-sub">{k.sub}</span>}
                {k.cal && (
                  <a href={k.cal} target="_blank" rel="noopener noreferrer" className="kd-cal">
                    📅 Add to calendar
                  </a>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Timings */}
      {timed.length > 0 && (
        <section className="section section-tight" id="timings">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">Timings · समय</p>
              <h2>When each race runs</h2>
              <p className="muted">All runs start on the dot, even with one person on the start line.</p>
            </div>
            <div className="table-wrap reveal">
              <table className="timing-table">
                <thead>
                  <tr>
                    <th>Race</th>
                    <th>Assemble</th>
                    <th>Flag-off</th>
                    <th>Cut-off</th>
                    <th className="tt-closes">Course closes</th>
                  </tr>
                </thead>
                <tbody>
                  {timed.map((r) => (
                    <tr key={r.slug} style={{ "--race": r.color } as React.CSSProperties}>
                      <td>
                        <span className="race-dot" aria-hidden="true" />
                        <strong>{r.distance.replace(/\.\d+/, "").replace(" KM", " K")}</strong> <span className="muted tt-name">{r.name}</span>
                      </td>
                      <td>{r.assemble ?? "–"}</td>
                      <td>
                        <b>{r.start}</b>
                      </td>
                      <td>{r.cutoff ?? "–"}</td>
                      <td className="tt-closes">{r.endBy ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="center mt">
              <Link href={`${e.basePath}/race-day`} className="link">
                Full race-morning timeline →
              </Link>
            </div>
          </div>
        </section>
      )}

      {e.theme && (
        <div className="container">
          <Link href={`${e.basePath}/gallery#theme`} className="theme-link reveal">
            <span>
              <span aria-hidden="true">🌊 </span>
              <strong>
                {e.edition} theme: {e.theme.title}
              </strong>
              {e.theme.tagline && <> · {e.theme.tagline}</>}
            </span>
            <span className="theme-link-cta">See the theme →</span>
          </Link>
        </div>
      )}

      <section className="section">
        <div className="container info-grid">
          <article className="info-card reveal" id="bib">
            <h3>BIB collection</h3>
            <p className="hi">बिब चेस्ट नंबर यहाँ से लें</p>
            {e.bibCollection ? (
              <>
                <ul className="plain">
                  {e.bibCollection.slots.map((s) => (
                    <li key={s.day}>
                      <strong>{s.day}</strong> · {s.time}
                    </li>
                  ))}
                </ul>
                <p>
                  <strong className="text-red">{e.bibCollection.venue}</strong>
                </p>
                {e.links.bibVenueMap && (
                  <a href={e.links.bibVenueMap} target="_blank" rel="noopener noreferrer" className="link">
                    Open in Google Maps ↗
                  </a>
                )}
                {e.bibCollection.note && (
                  <p className="note">
                    {e.bibCollection.note}
                    {e.bibCollection.noteHi && (
                      <>
                        <br />
                        <span className="hi">{e.bibCollection.noteHi}</span>
                      </>
                    )}
                  </p>
                )}
                {e.rules && (
                  <Link href={`${e.basePath}/rules#bib-collection`} className="link">
                    Collecting for someone else? Read the rules →
                  </Link>
                )}
              </>
            ) : (
              <p className="muted">Dates and venue will be announced closer to race day.</p>
            )}
          </article>

          {e.courseMap ? (
            <article className="info-card course-map-card reveal" id="course">
              <h3>Interactive course map</h3>
              <p className="hi">सभी दौड़ों का रूट मैप</p>
              <p className="muted">Route, km markers, U-turns, elevation and parking for every race. Tap your distance:</p>
              <div className="btn-row">
                {e.races
                  .filter((r) => r.courseMapId)
                  .map((r) => (
                    <Link
                      key={r.slug}
                      href={`${e.basePath}/course-map#${r.courseMapId}`}
                      className="btn btn-ghost"
                      style={{ "--race": r.color } as React.CSSProperties}
                    >
                      <span className="race-dot" aria-hidden="true" />
                      {r.distance.replace(/\.\d+/, "").replace(" KM", "K")}
                    </Link>
                  ))}
              </div>
              <Link href={`${e.basePath}/course-map`} className="link">
                Open the course map →
              </Link>
            </article>
          ) : (
          <article className="info-card reveal" id="course">
            <h3>Run tracks</h3>
            {routes.length ? (
              <ul className="plain">
                {routes.map((r) => (
                  <li key={r.slug}>
                    <a href={r.routeUrl} target="_blank" rel="noopener noreferrer" className="link">
                      {r.name} ({r.distance}){r.track ? ` · ${r.track}` : ""} ↗
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Route maps will be published soon.</p>
            )}
          </article>
          )}

          <article className="info-card reveal">
            <h3>Before you register</h3>
            <ul className="plain">
              <li>All runs are timed and finishers get a timing certificate.</li>
              {e.prizes && <li>Running for prize money? Register in the competitive category.</li>}
              <li>
                Please read the{" "}
                {e.rules ? (
                  <Link href={`${e.basePath}/rules`} className="link">
                    rules, regulations and FAQ
                  </Link>
                ) : (
                  "rules, regulations and FAQ"
                )}{" "}
                before registering.
              </li>
              <li>The form is in English. Ask someone for help if you need it; every section must be filled in.</li>
            </ul>
          </article>
        </div>
      </section>

      {/* Rules & FAQ teaser */}
      {e.rules && (
        <section className="section section-tight" id="rules">
          <div className="container">
            <div className="rules-teaser reveal">
              <div>
                <p className="eyebrow">Rules &amp; FAQ · नियम</p>
                <h2>Know the rules before you run</h2>
                <ul className="rules-teaser-list">
                  <li>Entries are non-refundable and non-transferable</li>
                  <li>BIB on the front, timing chip never folded: no chip, no timing</li>
                  {e.rules.sections.some((s) => s.id === "prize-money") && <li>Prize money for the competitive category only</li>}
                  <li>Protests within 30 minutes of results, ₹1,000 fee</li>
                </ul>
              </div>
              <div className="rules-teaser-links">
                {e.rules.sections.map((s) => (
                  <Link key={s.id} href={`${e.basePath}/rules#${s.id}`}>
                    {s.title} <span>{s.items.length}</span>
                  </Link>
                ))}
                <Link href={`${e.basePath}/rules#faq`} className="rt-faq">
                  FAQ <span>{e.rules.faq.reduce((n, g) => n + g.items.length, 0)} questions</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {e.facilities && (
        <section className="section section-sand" id="facilities">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">Facilities for all participants</p>
              <h2>सभी श्रेणी में प्रतिभागी को मिलने वाली सुविधा</h2>
            </div>
            <ul className="facility-grid with-icons">
              {e.facilities.map((f, i) => (
                <li key={f.en} className="reveal" style={{ "--delay": `${(i % 4) * 50}ms` } as React.CSSProperties}>
                  <FacilityIcon name={f.en} />
                  <div>
                    <strong>{f.en}</strong>
                    {f.hi && <span className="hi">{f.hi}</span>}
                  </div>
                </li>
              ))}
            </ul>
            {(e.images?.prizeMoney || e.images?.facilities) && (
              <div className="split mt">
                {e.images.prizeMoney && (
                  <Image src={e.images.prizeMoney} alt="Prize money poster" width={768} height={960} className="rounded shadow" />
                )}
                {e.images.facilities && (
                  <Image src={e.images.facilities} alt="Facilities poster" width={768} height={1152} className="rounded shadow" />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="section" id="venue">
        <div className={`container ${hasMap ? "split" : ""}`}>
          <div>
            <p className="eyebrow">Location of event</p>
            <h2>{e.venue.name}</h2>
            <p className="lead">{e.venue.detail}</p>
            {hasMap && (
              <a href={directionsUrl(e)} target="_blank" rel="noopener noreferrer" className="btn btn-dark">
                Directions ↗
              </a>
            )}
          </div>
          <VenueMap e={e} />
        </div>
      </section>

      {e.hotels && (
        <section className="section section-sand" id="stay">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">Stay</p>
              <h2>Hotels near the venue</h2>
              <p>Ask for the LetsRun marathon registration offer when you call. Taxes are extra.</p>
            </div>
            <div className="hotel-grid">
              {e.hotels.map((h) => (
                <a key={h.name} href={`tel:+91${h.phone}`} className="hotel-card">
                  <strong>{h.name}</strong>
                  <span>{h.phone}</span>
                </a>
              ))}
            </div>
            {e.links.hotelsMap && (
              <div className="center mt">
                <a href={e.links.hotelsMap} target="_blank" rel="noopener noreferrer" className="link">
                  More hotels on Google Maps ↗ (please enquire directly)
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      <RegisterCta e={e} />
    </>
  );
}
