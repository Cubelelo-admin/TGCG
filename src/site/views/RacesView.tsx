import Image from "next/image";
import Link from "next/link";
import PageHero from "@/site/components/PageHero";
import PrizeTable from "@/site/components/PrizeTable";
import RaceCards from "@/site/components/RaceCards";
import RegisterCta from "@/site/components/RegisterCta";
import type { EventConfig, Race } from "@/site/content/types";
import { inr, isRegistrationOpen, routeLink } from "@/site/lib/event";

// Route link: the event's interactive course map (same tab) or an external route page (new tab)
function RouteLink({ e, r, children, className }: { e: EventConfig; r: Race; children: React.ReactNode; className?: string }) {
  const l = routeLink(e, r);
  if (!l) return null;
  return l.external ? (
    <a href={l.href} target="_blank" rel="noopener noreferrer" className={className}>
      {children} ↗
    </a>
  ) : (
    <Link href={l.href} className={className}>
      {children} →
    </Link>
  );
}

const allRows: [string, keyof Race][] = [
  ["Assemble", "assemble"],
  ["Warm-up Zumba", "warmup"],
  ["Start", "start"],
  ["Cut-off", "cutoff"],
  ["End by", "endBy"],
  ["Min. age", "minAge"],
  ["Track", "track"],
];

const cell = (r: Race, key: keyof Race) =>
  key === "minAge" ? (r.minAge ? `${r.minAge}+ years` : "TBA") : String(r[key] ?? "TBA");

export default function RacesView({ e }: { e: EventConfig }) {
  const open = isRegistrationOpen(e);
  // The Track row only makes sense when the event has more than one named track
  const rows = allRows.filter(([, key]) => key !== "track" || e.races.some((r) => r.track));
  return (
    <>
      <PageHero
        eyebrow={e.dateLabel}
        title={e.prizes ? "Races, schedule, fees & prizes" : "Races, schedule & fees"}
        subtitle={`${e.shortName} ${e.edition} · ${e.venue.name}`}
      >
        {(e.fees.length > 0 || e.prizes) && (
          <nav className="jump-links" aria-label="On this page">
            <a href="#schedule">Schedule</a>
            {e.fees.length > 0 && <a href="#fees">Fees</a>}
            {e.prizes && <a href="#prizes">Prize money</a>}
          </nav>
        )}
      </PageHero>

      <section className="section" id="schedule">
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow">Race day schedule</p>
            <h2>Be ready. Run your distance.</h2>
          </div>
          {e.races.length ? (
            <>
              {/* Desktop / tablet: comparison table */}
              <div className="table-wrap schedule-table">
                <table className="schedule">
                  <thead>
                    <tr>
                      <td />
                      {e.races.map((r) => (
                        <th key={r.slug} scope="col" style={{ "--race": r.color } as React.CSSProperties}>
                          <span className="th-name">{r.name}</span>
                          <span className="th-dist">{r.distance}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([label, key]) => (
                      <tr key={key}>
                        <th scope="row">{label}</th>
                        {e.races.map((r) => (
                          <td key={r.slug}>{cell(r, key)}</td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <th scope="row">Route</th>
                      {e.races.map((r) => (
                        <td key={r.slug}>
                          {routeLink(e, r) ? <RouteLink e={e} r={r}>View map</RouteLink> : "TBA"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Phones: one card per race */}
              <div className="schedule-cards">
                {e.races.map((r) => (
                  <article key={r.slug} className="schedule-card" style={{ "--race": r.color } as React.CSSProperties}>
                    <header>
                      <span className="th-dist">{r.distance}</span>
                      <h3>{r.name}</h3>
                      {r.nameHi && <span className="hi">{r.nameHi}</span>}
                    </header>
                    <dl>
                      {rows.map(([label, key]) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>{cell(r, key)}</dd>
                        </div>
                      ))}
                    </dl>
                    <RouteLink e={e} r={r} className="link">
                      View route map
                    </RouteLink>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <RaceCards races={[]} basePath={e.basePath} />
          )}
        </div>
      </section>

      <section className="section section-sand" id="fees">
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow">Registration fees</p>
            <h2>Pick your category</h2>
          </div>
          {e.fees.length ? (
            <div className="fee-grid">
              {e.fees.map((f) => (
                <div key={f.title} className={`fee-card reveal ${f.featured ? "fee-featured" : ""}`}>
                  {f.badge && <span className={`badge ${f.featured ? "" : "badge-muted"}`}>{f.badge}</span>}
                  <h3>{f.title}</h3>
                  {f.titleHi && <p className="hi">{f.titleHi}</p>}
                  <p className="price">
                    {inr(f.price)}
                    {f.tax && <small className="price-tax"> {f.tax}</small>}
                  </p>
                  {f.taxHi && <p className="hi small">{f.taxHi}</p>}
                  <ul className="fee-list">
                    {f.categories.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  {f.note && <p className="small">{f.note}</p>}
                  {open && (
                    <Link href={`${e.basePath}/register`} className={`btn ${f.featured ? "btn-primary" : "btn-dark"} btn-block`}>
                      Register · {inr(f.price)}
                      {f.tax ? ` ${f.tax}` : ""}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="coming-soon">
              <strong>Fees will be announced with registration.</strong>
              <span className="hi">शुल्क की घोषणा पंजीकरण के साथ होगी।</span>
            </div>
          )}
        </div>
      </section>

      {e.prizes && (
        <section className="section" id="prizes">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">Prize money · नकद पुरस्कार</p>
              <h2>Run fast, win big</h2>
              <p className="muted">
                Prize money is for runners registered in the competitive category. Same amount for men and women.
              </p>
            </div>
            <PrizeTable prizes={e.prizes} />
            {e.rules && (
              <div className="center mt">
                <Link href={`${e.basePath}/rules#prize-money`} className="link">
                  Prize money rules &amp; how prizes are paid →
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {(e.images?.schedule || e.images?.ageEligibility) && (
        <section className={`section ${e.prizes ? "section-sand" : ""}`}>
          <div className="container split">
            {e.images.schedule && (
              <Image src={e.images.schedule} alt="Race day schedule poster" width={768} height={805} className="rounded shadow reveal" />
            )}
            {e.images.ageEligibility && (
              <Image src={e.images.ageEligibility} alt="Age eligibility poster" width={1080} height={540} className="rounded shadow reveal" />
            )}
          </div>
        </section>
      )}

      <RegisterCta e={e} />
    </>
  );
}
