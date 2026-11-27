import type { EventConfig, Race } from "@/site/content/types";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function waLink(e: EventConfig, text: string) {
  return `${e.contact.whatsappUrl}${encodeURIComponent(text)}`;
}

export function raceKm(r: Race) {
  if (r.km) return r.km;
  const n = parseFloat(r.distance);
  return Number.isFinite(n) ? n : 0;
}

// "6:30 hrs" -> 390, "2 hrs" -> 120
export function cutoffMinutes(cutoff?: string) {
  if (!cutoff) return null;
  const m = cutoff.match(/(\d+)(?::(\d+))?/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2] ?? 0);
}

// Where a race's "route map" link goes: the event's own interactive course map if it has one,
// otherwise the external route link (if any).
export function routeLink(e: EventConfig, r: Race): { href: string; external: boolean } | null {
  if (e.courseMap && r.courseMapId) return { href: `${e.basePath}/course-map#${r.courseMapId}`, external: false };
  if (r.routeUrl) return { href: r.routeUrl, external: true };
  return null;
}

// "4:00 AM" -> 240 (minutes after midnight)
export function clockToMin(t?: string) {
  const m = t?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  return ((+m[1] % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + +m[2];
}

// Price per race, from the fee tables: lowest price, plus the competitive price if that race has one.
// Matches fee categories like "42 KM Marathon" to races by whole km.
export function racePrices(e: EventConfig) {
  const out: Record<string, { from: number; competitive?: number; tax?: string }> = {};
  for (const r of e.races) {
    const key = `${Math.floor(raceKm(r))} KM`;
    const fees = e.fees.filter((f) => f.categories.some((c) => c.startsWith(key)));
    if (!fees.length) continue;
    const comp = fees.find((f) => /^competitive/i.test(f.title));
    const from = Math.min(...fees.map((f) => f.price));
    out[r.slug] = { from, competitive: comp && fees.length > 1 ? comp.price : undefined, tax: fees.find((f) => f.price === from)?.tax };
  }
  return out;
}

// ---------- Registration status ----------
// "soon":   no registration form yet  → "Notify me" buttons
// "open":   form exists and the deadline (if any) hasn't passed
// "closed": the deadline has passed   → no register buttons, no embedded form
// Pages are re-rendered hourly (revalidate in app/layout.tsx), so this flips within an hour of the deadline.
export type RegistrationStatus = "soon" | "open" | "closed";

export function registrationStatus(e: EventConfig, now = Date.now()): RegistrationStatus {
  if (!e.links.register) return "soon";
  if (e.registrationDeadlineDate && now > new Date(e.registrationDeadlineDate).getTime()) return "closed";
  return "open";
}

export const isRegistrationOpen = (e: EventConfig, now = Date.now()) => registrationStatus(e, now) === "open";

// Race start / end as epoch ms (end = start + durationHours, default 6)
export function raceWindow(e: EventConfig) {
  const start = new Date(e.date).getTime();
  return { start, end: start + (e.durationHours ?? 6) * 3_600_000 };
}

// Placeholder slot times like "Time to be announced" / "TBA" should not end up in calendar entries
export const isPlaceholderTime = (t?: string) => !t || /to be announced|\btba\b|\btbd\b/i.test(t);

export function minFee(e: EventConfig) {
  return e.fees.length ? Math.min(...e.fees.map((f) => f.price)) : null;
}

// ---------- Calendar ----------
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function calendarParts(e: EventConfig, siteUrl: string) {
  const w = raceWindow(e);
  const start = new Date(w.start);
  const end = new Date(w.end);
  const title = `${e.shortName} ${e.edition}`;
  const location = `${e.venue.name}, ${e.venue.detail}`;
  const lines = [`${e.name} ${e.edition}`, `Race information: ${siteUrl}${e.basePath}/race-day`];
  if (e.bibCollection) {
    lines.push(
      `BIB collection at ${e.bibCollection.venue}: ${e.bibCollection.slots
        .map((s) => (isPlaceholderTime(s.time) ? s.day : `${s.day} ${s.time}`))
        .join("; ")}`,
    );
  }
  for (const r of e.races) {
    if (r.assemble || r.start) lines.push(`${r.name} (${r.distance}): assemble ${r.assemble ?? "TBA"}, start ${r.start ?? "TBA"}`);
  }
  return { start, end, title, location, details: lines.join("\n") };
}

export function googleCalendarUrl(e: EventConfig, siteUrl: string) {
  const p = calendarParts(e, siteUrl);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: p.title,
    dates: `${utcStamp(p.start)}/${utcStamp(p.end)}`,
    location: p.location,
    details: p.details,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

// All-day Google Calendar event, e.g. "BIB collection" on "18 December 2026"
export function allDayCalendarUrl(title: string, day: string | Date, details = "", location = "") {
  const d = typeof day === "string" ? new Date(`${day} 12:00`) : day;
  if (Number.isNaN(d.getTime())) return null;
  const ymd = (x: Date) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
  const next = new Date(d.getTime() + 86_400_000);
  const q = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${ymd(d)}/${ymd(next)}`, details, location });
  return `https://calendar.google.com/calendar/render?${q}`;
}

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcs(e: EventConfig, siteUrl: string) {
  const p = calendarParts(e, siteUrl);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LetsRun//TGCG.run//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.slug}-${e.edition}@tgcg.run`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(p.start)}`,
    `DTEND:${utcStamp(p.end)}`,
    `SUMMARY:${icsEscape(p.title)}`,
    `LOCATION:${icsEscape(p.location)}`,
    `DESCRIPTION:${icsEscape(p.details)}`,
    `URL:${siteUrl}${e.basePath}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`${p.title} is tomorrow`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export const SITE_URL = "https://tgcg.run";
