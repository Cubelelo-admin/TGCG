"use client";

import { useState } from "react";
import type { PastEdition, Podium } from "@/site/content/types";

// Official results / certificate page for an edition, optionally straight to one BIB.
export function resultUrl(ed: PastEdition, bib?: string) {
  if (ed.provider === "sts") {
    const q = { e_name: ed.name, e_id: ed.eventId, ...(bib ? { bibNo: bib } : {}) };
    return `https://sportstimingsolutions.in/results?q=${encodeURIComponent(btoa(JSON.stringify(q)))}`;
  }
  return `https://ifinish.in/eventresult/result-${encodeURIComponent(ed.name)}`;
}
const partner = (ed: PastEdition) => (ed.provider === "sts" ? "Sports Timing Solutions" : "iFinish");
const medal = ["🥇", "🥈", "🥉"];
const trimTime = (t: string) => t.replace(/^00:/, "").replace(/^0(\d:)/, "$1");

function PodiumList({ p }: { p: Podium }) {
  return (
    <div className="pr-podium">
      <h5>{p.name}</h5>
      <ol>
        {p.top.map((t, i) => (
          <li key={i}>
            <span aria-label={`Rank ${i + 1}`}>{medal[i]}</span>
            <strong>{t.name}</strong>
            <time>{trimTime(t.time)}</time>
          </li>
        ))}
      </ol>
    </div>
  );
}

type Gap = { label: string; after: number; note: string; noteHi?: string };

export default function PastResults({ editions, gaps = [] }: { editions: PastEdition[]; gaps?: Gap[] }) {
  const [year, setYear] = useState(editions[0]?.year);
  const [gap, setGap] = useState<Gap | null>(null);
  const [bib, setBib] = useState("");
  const ed = editions.find((x) => x.year === year) ?? editions[0];
  if (!ed) return null;

  const tabs = (
    <div className="pr-years" role="tablist" aria-label="Edition">
      {editions.map((x) => (
        <span key={x.year} className="pr-tabgroup">
          <button
            type="button"
            role="tab"
            aria-selected={!gap && x.year === ed.year}
            className={!gap && x.year === ed.year ? "on" : ""}
            onClick={() => {
              setGap(null);
              setYear(x.year);
            }}
          >
            {x.year}
          </button>
          {gaps
            .filter((g) => g.after === x.year)
            .map((g) => (
              <button key={g.label} type="button" role="tab" aria-selected={gap === g} className={`pr-gap ${gap === g ? "on" : ""}`} onClick={() => setGap(g)}>
                {g.label}
              </button>
            ))}
        </span>
      ))}
    </div>
  );

  if (gap) {
    return (
      <div className="past-results">
        {tabs}
        <div className="pr-gapnote">
          <span aria-hidden="true">😷</span>
          <div>
            <strong>{gap.label}: non-timed, invite-only runs</strong>
            <p>{gap.note}</p>
            {gap.noteHi && <p className="hi">{gap.noteHi}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="past-results">
      {tabs}

      {/* Certificate lookup for the selected year */}
      <form
        className="pr-cert"
        onSubmit={(ev) => {
          ev.preventDefault();
          window.open(resultUrl(ed, ed.provider === "sts" ? bib.trim() || undefined : undefined), "_blank", "noopener,noreferrer");
        }}
      >
        <div>
          <strong>Your {ed.year} certificate</strong>
          <span>
            {ed.name} · results by {partner(ed)}
          </span>
        </div>
        {ed.provider === "sts" ? (
          <div className="pr-cert-row">
            <input
              aria-label={`BIB number for ${ed.year}`}
              inputMode="text"
              autoComplete="off"
              placeholder={`${ed.year} BIB number`}
              value={bib}
              onChange={(ev) => setBib(ev.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              {bib.trim() ? "Get my certificate ↗" : "All results ↗"}
            </button>
          </div>
        ) : (
          <div className="pr-cert-row">
            <button type="submit" className="btn btn-primary">
              Open {ed.year} results ↗
            </button>
            <small>Search your name or BIB there to download the certificate.</small>
          </div>
        )}
      </form>

      <div className="pr-races">
        {ed.races.map((r) => (
          <article key={r.source} className="pr-race">
            <header>
              <h4>{r.label}</h4>
              {r.competitive ? <span className="pr-tag pr-comp">🏆 Competitive</span> : <span className="pr-tag">Non-competitive</span>}
            </header>
            <div className="pr-main">
              {r.main.map((p) => (
                <PodiumList key={p.name} p={p} />
              ))}
            </div>
            {r.groups.length > 0 && (
              <details className="pr-groups">
                <summary>Age categories ({r.groups.length})</summary>
                <div className="pr-main">
                  {r.groups.map((p) => (
                    <PodiumList key={p.name} p={p} />
                  ))}
                </div>
              </details>
            )}
          </article>
        ))}
      </div>
      <p className="pr-note">
        Chip (net) times, top 3 per category, from the official timing partner. Full results and certificates:{" "}
        <a href={resultUrl(ed)} target="_blank" rel="noopener noreferrer" className="link">
          {ed.name} on {partner(ed)} ↗
        </a>
      </p>
    </div>
  );
}
