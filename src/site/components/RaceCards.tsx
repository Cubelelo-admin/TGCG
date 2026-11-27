import Link from "next/link";
import type { Race } from "@/site/content/types";

type Prices = Record<string, { from: number; competitive?: number; tax?: string }>;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function RaceCards({
  races,
  basePath,
  canRegister = true,
  prices,
}: {
  races: Race[];
  basePath: string;
  canRegister?: boolean;
  prices?: Prices;
}) {
  if (!races.length) {
    return (
      <div className="coming-soon">
        <span className="coming-soon-icon" aria-hidden="true">🏃</span>
        <strong>Race categories are being announced soon.</strong>
        <span className="hi">दौड़ की श्रेणियाँ जल्द ही घोषित की जाएंगी।</span>
      </div>
    );
  }

  return (
    <div className="race-grid">
      {races.map((r, i) => (
        <Link
          key={r.slug}
          href={canRegister ? `${basePath}/register` : `${basePath}/races`}
          className="race-card reveal"
          style={{ "--race": r.color, "--delay": `${i * 70}ms` } as React.CSSProperties}
          aria-label={`${r.name}, ${r.distance}. ${canRegister ? "Register" : "See details"}`}
        >
          <div className="race-card-top">
            <span className="race-distance">{r.distance}</span>
            <h3>{r.name}</h3>
            {r.nameHi && <span className="hi">{r.nameHi}</span>}
          </div>
          <dl className="race-facts">
            <div>
              <dt>Start</dt>
              <dd>{r.start ?? "TBA"}</dd>
            </div>
            <div>
              <dt>Cut-off</dt>
              <dd>{r.cutoff ?? "TBA"}</dd>
            </div>
            <div>
              <dt>Min. age</dt>
              <dd>{r.minAge ? `${r.minAge}+` : "TBA"}</dd>
            </div>
          </dl>
          {r.motto && <p className="race-motto">{r.motto}</p>}
          {prices?.[r.slug] && (
            <p className="race-price">
              <span>{prices[r.slug].competitive ? "from" : "Fee"}</span> <strong>{inr(prices[r.slug].from)}</strong>
              {prices[r.slug].tax && <span> {prices[r.slug].tax}</span>}
              {prices[r.slug].competitive && <small>Competitive {inr(prices[r.slug].competitive!)} · cash prizes</small>}
            </p>
          )}
          <span className="race-card-cta">
            {canRegister ? "Register" : "Details"} <span aria-hidden="true">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
