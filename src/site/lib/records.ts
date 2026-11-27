import type { PastEdition } from "@/site/content/types";

// TGCG track records: fastest chip time per distance, gender and category (competitive / non-competitive)
// across past editions' podiums. Recomputed from past-results.ts, so a data refresh updates them.
// Editions before competitive categories existed count as non-competitive. 2016 has no gender split, so it's left out.

export type CourseRecord = { name: string; bib?: string; time: string; year: number };
export type RecordRow = { distance: string; men?: CourseRecord; women?: CourseRecord };
export type RecordTable = { competitive: boolean; rows: RecordRow[] };

const toSec = (t: string) => t.split(":").reduce((s, p) => s * 60 + Number(p), 0);
const ORDER = ["42K Marathon", "21K Half Marathon", "10K", "6K Dream Run"];

export function courseRecords(editions: PastEdition[], skipYears: number[] = [2016]): RecordTable[] {
  const best = new Map<string, CourseRecord & { sec: number }>();
  for (const ed of editions) {
    if (skipYears.includes(ed.year)) continue;
    for (const r of ed.races)
      for (const p of r.main) {
        if (p.name !== "Men" && p.name !== "Women") continue;
        const t = p.top[0];
        const sec = t?.time ? toSec(t.time) : 0;
        if (!sec) continue;
        const key = `${r.competitive ? "C" : "N"}|${r.label}|${p.name}`;
        const cur = best.get(key);
        if (!cur || sec < cur.sec) best.set(key, { name: t.name, bib: t.bib, time: t.time, year: ed.year, sec });
      }
  }
  return [true, false]
    .map((competitive) => {
      const c = competitive ? "C" : "N";
      const rows = ORDER.map((distance) => {
        const pick = (g: string) => {
          const v = best.get(`${c}|${distance}|${g}`);
          return v ? { name: v.name, bib: v.bib, time: v.time, year: v.year } : undefined;
        };
        return { distance, men: pick("Men"), women: pick("Women") };
      }).filter((row) => row.men || row.women);
      return { competitive, rows };
    })
    .filter((t) => t.rows.length);
}
