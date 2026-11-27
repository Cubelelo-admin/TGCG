import Link from "next/link";
import type { Race } from "@/site/content/types";

type Prices = Record<string, { from: number; competitive?: number; tax?: string; noPrizes?: boolean }>;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// "Entry from" only when the competitive entry really costs more (Raipur ₹1,450 / ₹1,750); when both cost the
// same (Raigarh ₹500 + tax) the card gives one fee and says the competitive entry is the one with prizes.
function RacePrice({ p }: { p: Prices[string] }) {
  const dearer = p.competitive !== undefined && p.competitive > p.from;
  return (
    <p className="race-price">
      <span className="race-price-label">{dearer ? "Entry from" : "Entry fee"}</span>
      <span className="race-price-amount">
        <strong>{inr(p.from)}</strong>
        {p.tax && ` ${p.tax}`}
      </span>
      {p.competitive !== undefined ? (
        <small>{dearer ? `Competitive ${inr(p.competitive)} · cash prizes` : "Competitive entries race for cash prizes"}</small>
      ) : (
        p.noPrizes && <small>Non-competitive · no cash prizes</small>
      )}
    </p>
  );
}

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
          {prices?.[r.slug] && <RacePrice p={prices[r.slug]} />}
          <span className="race-card-cta">
            {canRegister ? "Register" : "Details"} <span aria-hidden="true">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
