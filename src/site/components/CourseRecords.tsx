import type { PastEdition } from "@/site/content/types";
import { courseRecords, type CourseRecord } from "@/site/lib/records";

const trim = (t: string) => t.replace(/^00:/, "").replace(/^0(\d:)/, "$1");
const COLOR: Record<string, string> = { "42K Marathon": "#d93a3a", "21K Half Marathon": "#1f8fb3", "10K": "#2e9a4c", "6K Dream Run": "#ef8a1f" };

function Cell({ label, r }: { label: string; r?: CourseRecord }) {
  return (
    <div className="rec-cell">
      <span className="rec-g">{label}</span>
      {r ? (
        <>
          <strong className="rec-time">{trim(r.time)}</strong>
          <span className="rec-name">{/^BIB /.test(r.name) ? "Name not recorded" : r.name}</span>
          <span className="rec-meta">
            {r.bib && <>BIB {r.bib} · </>}
            {r.year}
          </span>
        </>
      ) : (
        <span className="rec-meta">No record yet</span>
      )}
    </div>
  );
}

// TGCG track records, one table per category (competitive / non-competitive).
export default function CourseRecords({ editions }: { editions: PastEdition[] }) {
  const tables = courseRecords(editions);
  if (!tables.length) return null;

  return (
    <div className="rec-tables">
      {tables.map((t) => (
        <section key={String(t.competitive)} className="rec-table reveal" aria-label={t.competitive ? "Competitive records" : "Non-competitive records"}>
          <header className="rec-head">
            <h3>{t.competitive ? "🏆 Competitive" : "Non-competitive"}</h3>
            <span>{t.competitive ? "Cash-prize category" : "Open category"}</span>
          </header>
          <div className="rec-cols" aria-hidden="true">
            <span>Distance</span>
            <span>Men</span>
            <span>Women</span>
          </div>
          {t.rows.map((row) => (
            <div key={row.distance} className="rec-row" style={{ "--race": COLOR[row.distance] ?? "var(--accent)" } as React.CSSProperties}>
              <span className="rec-dist">{row.distance}</span>
              <Cell label="Men" r={row.men} />
              <Cell label="Women" r={row.women} />
            </div>
          ))}
        </section>
      ))}
      <p className="records-note">
        Fastest official chip times at TGCG / LetsRun Raipur since 2017, from the timing partners&apos; results. Editions
        before the competitive category was introduced count as non-competitive. The route has changed over the years.
      </p>
    </div>
  );
}
