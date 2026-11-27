import Link from "next/link";
import AddToCalendar from "@/site/components/AddToCalendar";
import Bi from "@/site/components/Bi";
import PageHero from "@/site/components/PageHero";
import RegisterCta from "@/site/components/RegisterCta";
import VenueMap, { directionsUrl, hasVenueMap } from "@/site/components/VenueMap";
import Weather from "@/site/components/Weather";
import type { EventConfig } from "@/site/content/types";
import { routeLink, waLink } from "@/site/lib/event";

const checklist: { en: string; hi: string }[] = [
  { en: "Pin your BIB on the front of your T-shirt, fully visible", hi: "BIB को टी-शर्ट के सामने साफ़ दिखने वाली जगह पर लगाएँ" },
  { en: "Don't fold or bend the timing chip on the BIB", hi: "BIB पर लगी टाइमिंग चिप को मोड़ें नहीं" },
  { en: "Write your emergency contact on the back of the BIB", hi: "BIB के पीछे आपातकालीन संपर्क नंबर लिखें" },
  { en: "Reach the venue before your assembly time", hi: "असेंबली समय से पहले स्थल पर पहुँचें" },
  { en: "Light breakfast 1.5–2 hours before your start", hi: "शुरू होने से 1.5–2 घंटे पहले हल्का नाश्ता करें" },
  { en: "Wear shoes and clothes you've already trained in", hi: "वही जूते और कपड़े पहनें जिनमें आपने अभ्यास किया है" },
  { en: "Drink water at the aid stations, even if you aren't thirsty", hi: "प्यास न लगे तब भी पानी स्टेशन पर पानी पिएँ" },
  { en: "Feeling unwell? Stop and tell the nearest volunteer or medic", hi: "तबीयत ठीक न लगे तो रुकें और नज़दीकी वॉलंटियर/मेडिकल टीम को बताएँ" },
];

export default function RaceDayView({ e }: { e: EventConfig }) {
  const hasMap = hasVenueMap(e);
  const timed = e.races.filter((r) => r.assemble || r.start);
  const coursed = e.races.filter((r) => r.courseNote);

  return (
    <>
      <PageHero eyebrow={e.dateLabel} title="Race-day guide" subtitle={`Everything for race morning at ${e.venue.name}. रेस के दिन की पूरी जानकारी।`}>
        <AddToCalendar e={e} className="hero-cal hero-cal-dark" />
      </PageHero>

      {/* Timeline */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow">Your morning</p>
            <h2>When to be where</h2>
          </div>
          {timed.length ? (
            <div className="timeline-grid">
              {timed.map((r) => (
                <article key={r.slug} className="timeline-card reveal" style={{ "--race": r.color } as React.CSSProperties}>
                  <header>
                    <span className="th-dist">{r.distance}</span>
                    <h3>{r.name}</h3>
                  </header>
                  <ol className="timeline">
                    {r.assemble && (
                      <li>
                        <time>{r.assemble}</time> Assemble at the start area
                      </li>
                    )}
                    {r.warmup && (
                      <li>
                        <time>{r.warmup}</time> Warm-up Zumba
                      </li>
                    )}
                    {r.start && (
                      <li className="timeline-start">
                        <time>{r.start}</time> Flag off 🏁
                      </li>
                    )}
                    {r.endBy && (
                      <li>
                        <time>{r.endBy}</time> Course closes{r.cutoff ? ` (cut-off ${r.cutoff})` : ""}
                      </li>
                    )}
                  </ol>
                </article>
              ))}
            </div>
          ) : (
            <div className="coming-soon">
              <strong>Race-day timings will be published soon.</strong>
              <span className="hi">रेस डे का समय जल्द ही घोषित होगा।</span>
            </div>
          )}
        </div>
      </section>

      {/* Please note (start, punctuality, tracks, rules) */}
      {(e.raceDay?.points?.length || coursed.length > 0) && (
        <section className="section section-tight" id="note">
          <div className="container narrow">
            <div className="section-head reveal">
              <p className="eyebrow">Please note · ध्यान दें</p>
              <h2>Pay attention to the following points</h2>
            </div>
            <ul className="note-list reveal">
              <li>
                <span>
                  All {e.races.length} category runs start from <strong>{e.venue.name}</strong>
                  {e.venue.detail ? `, ${e.venue.detail.split(",")[0]}` : ""}
                  {hasMap && (
                    <>
                      {" · "}
                      <a href={directionsUrl(e)} target="_blank" rel="noopener noreferrer" className="link">
                        Google Maps ↗
                      </a>
                    </>
                  )}
                </span>
                <span className="hi">
                  सभी {e.races.length} श्रेणियों की दौड़ {e.venue.nameHi ?? e.venue.name} से शुरू होंगी
                </span>
              </li>
              {e.raceDay?.points?.map((p) => (
                <li key={p.en} className={p.strong ? "note-strong" : undefined}>
                  <span>{p.strong ? <strong>{p.en}</strong> : p.en}</span>
                  {p.hi && <span className="hi">{p.hi}</span>}
                </li>
              ))}
            </ul>

            {coursed.length > 0 && (
              <div className="note-tracks reveal">
                <h3>Tracks · ट्रैक</h3>
                {e.raceDay?.tracksIntro?.map((t) => (
                  <p key={t.en}>
                    {t.en}
                    {t.hi && <span className="hi">{t.hi}</span>}
                  </p>
                ))}
                <ul className="note-courses">
                  {coursed.map((r) => {
                    const link = routeLink(e, r);
                    return (
                      <li key={r.slug} style={{ "--race": r.color } as React.CSSProperties}>
                        <span className="race-dot" aria-hidden="true" />
                        <div>
                          <span>{r.courseNote}</span>
                          {r.courseNoteHi && <span className="hi">{r.courseNoteHi}</span>}
                        </div>
                        {link &&
                          (link.external ? (
                            <a href={link.href} target="_blank" rel="noopener noreferrer" className="link">
                              Course ↗
                            </a>
                          ) : (
                            <Link href={link.href} className="link">
                              Course map →
                            </Link>
                          ))}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {e.rules && (
              <p className="center mt">
                <Link href={`${e.basePath}/rules`} className="link">
                  Read all rules &amp; FAQ →
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Checklist + logistics */}
      <section className="section section-sand">
        <div className="container split split-top">
          <div className="reveal">
            <p className="eyebrow">Checklist</p>
            <h2>Before you leave home</h2>
            <ul className="check-list check-list-dark">
              {checklist.map((c) => (
                <li key={c.en}>
                  <Bi en={c.en} hi={c.hi} stack />
                </li>
              ))}
            </ul>
          </div>
          <div className="info-stack">
            <article className="info-card reveal">
              <h3>BIB collection</h3>
              {e.bibCollection ? (
                <>
                  <ul className="plain">
                    {e.bibCollection.slots.map((s) => (
                      <li key={s.day}>
                        <strong>{s.day}</strong> · {s.time}
                      </li>
                    ))}
                  </ul>
                  <p className="text-red">
                    <strong>{e.bibCollection.venue}</strong>
                  </p>
                  {e.links.bibVenueMap && (
                    <a href={e.links.bibVenueMap} target="_blank" rel="noopener noreferrer" className="link">
                      Open in Google Maps ↗
                    </a>
                  )}
                </>
              ) : (
                <p className="muted">Dates and venue will be announced closer to race day.</p>
              )}
            </article>
            <article className="info-card reveal">
              <h3>Parking &amp; bag drop</h3>
              {e.raceDay?.parking?.length || e.raceDay?.bagDrop ? (
                <ul className="plain">
                  {e.raceDay?.parking?.map((p) => <li key={p}>🅿️ {p}</li>)}
                  {e.raceDay?.bagDrop && <li>🎒 {e.raceDay.bagDrop}</li>}
                </ul>
              ) : null}
              {e.raceDay?.parkingMap && (
                <p>
                  <a href={e.raceDay.parkingMap} target="_blank" rel="noopener noreferrer" className="link">
                    Parking on Google Maps ↗
                  </a>
                  {e.courseMap && (
                    <>
                      {" · "}
                      <Link href={`${e.basePath}/course-map`} className="link">
                        Course map →
                      </Link>
                    </>
                  )}
                </p>
              )}
              {e.raceDay?.parking?.length || e.raceDay?.bagDrop ? null : (
                <p className="muted">Parking and bag-drop details will be shared on WhatsApp before race day.</p>
              )}
              {e.raceDay?.notes?.map((n) => (
                <p key={n} className="note">
                  {n}
                </p>
              ))}
            </article>
          </div>
        </div>
      </section>

      {/* Venue + weather */}
      <section className="section">
        <div className={`container ${hasMap ? "split split-top" : ""}`}>
          <div className="reveal">
            <p className="eyebrow">Venue</p>
            <h2>{e.venue.name}</h2>
            <p className="lead">{e.venue.detail}</p>
            {hasMap && (
              <a href={directionsUrl(e)} target="_blank" rel="noopener noreferrer" className="btn btn-dark">
                Get directions ↗
              </a>
            )}
            <div className="weather-box">
              <h3>Race-morning weather</h3>
              {hasMap ? (
                <Weather lat={e.venue.lat!} lng={e.venue.lng!} date={e.date} />
              ) : (
                <p className="muted">The forecast appears here once the venue is announced.</p>
              )}
            </div>
          </div>
          <VenueMap e={e} />
        </div>
      </section>

      {/* Help */}
      <section className="section section-navy">
        <div className="container center reveal">
          <p className="eyebrow">Race-day help</p>
          <h2>Stuck? Message us.</h2>
          <p className="lead">The LetsRun team is on WhatsApp all race weekend.</p>
          <div className="hero-actions center-actions">
            <a href={waLink(e, `Hi, I need help on race day for ${e.shortName}.`)} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-lg">
              WhatsApp {e.contact.whatsappNumber}
            </a>
            <Link href={`${e.basePath}/pace-calculator`} className="btn btn-ghost btn-lg">
              Plan your pace
            </Link>
          </div>
        </div>
      </section>

      <RegisterCta e={e} />
    </>
  );
}
