import type { PrizeTable as Prizes } from "@/site/content/types";
import { inr } from "@/site/lib/event";

const RANKS = ["🥇 1st", "🥈 2nd", "🥉 3rd", "4th", "5th"];

// Simple man / woman figures for the "same prize for men and women" banner
const Man = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="4" r="2.4" />
    <path d="M9 8h6a1.5 1.5 0 0 1 1.5 1.5V15h-2v7h-2.2v-5h-.6v5H9.5v-7h-2V9.5A1.5 1.5 0 0 1 9 8Z" />
  </svg>
);
const Woman = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="4" r="2.4" />
    <path d="M9.6 8h4.8l3 8h-3v6h-2v-5h-.8v5h-2v-6h-3Z" />
  </svg>
);

export default function PrizeTable({ prizes }: { prizes: Prizes }) {
  return (
    <>
      <div className="prize-equal reveal">
        <span className="prize-equal-icons">
          {Man}={Woman}
        </span>
        <p>
          <strong>Same prize money for men and women</strong>
          Men and women have separate winners in every category, and each winner gets the full amount
          {prizes.races.some((r) => r.ranks) ? " shown below." : "."}
          <span className="hi">पुरुष और महिला वर्ग के विजेता अलग-अलग हैं, दोनों को समान पुरस्कार राशि मिलेगी।</span>
        </p>
      </div>
      <div className="prize-grid">
        {prizes.races.map((r) => (
          <div key={r.name} className="prize-card reveal" style={{ "--race": r.color ?? "var(--brand)" } as React.CSSProperties}>
            <h3>{r.name}</h3>
            <span className="prize-tag">Men &amp; Women · each / पुरुष व महिला · प्रत्येक</span>
            {!r.ranks ? (
              <div className="prize-tba">
                <p>
                  <strong>Top 3 in each category</strong>
                </p>
                <ul>
                  {prizes.columns.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <p className="prize-tba-amt">
                  💰 Prize amounts to be announced
                  <span className="hi">पुरस्कार राशि जल्द घोषित होगी</span>
                </p>
              </div>
            ) : (
            <table className="prize-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  {prizes.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.ranks.map((row, i) => (
                  <tr key={i}>
                    <th scope="row">{RANKS[i] ?? `${i + 1}th`}</th>
                    {row.map((amt, j) => (
                      <td key={j}>{inr(amt)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        ))}
      </div>
      {(prizes.note || prizes.noteHi) && (
        <p className="note center prize-note">
          {prizes.note}
          {prizes.noteHi && <span className="hi">{prizes.noteHi}</span>}
        </p>
      )}
    </>
  );
}
