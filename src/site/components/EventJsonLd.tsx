// schema.org SportsEvent data so Google can show the race as an event (date, venue, prices) in search.
import type { EventConfig } from "@/site/content/types";
import { organiser } from "@/site/content/organiser";
import { raceWindow, registrationStatus, SITE_URL } from "@/site/lib/event";

const AVAILABILITY = {
  open: "https://schema.org/InStock",
  soon: "https://schema.org/PreOrder", // registration not open yet
  closed: "https://schema.org/SoldOut", // deadline has passed
} as const;

export default function EventJsonLd({ e }: { e: EventConfig }) {
  const w = raceWindow(e);
  const start = new Date(w.start);
  const end = new Date(w.end);
  const availability = AVAILABILITY[registrationStatus(e)];
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const image = [e.images?.hero, e.logo?.src, e.images?.medal].filter(Boolean).map((p) => `${SITE_URL}${p}`);
  const url = `${SITE_URL}${e.basePath}`;
  const registerUrl = availability === AVAILABILITY.open && e.links.register ? e.links.register : url;

  const data = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${e.name} ${e.edition}`,
    alternateName: `${e.shortName} ${e.edition}`,
    sport: "Running",
    description: `${e.races.map((r) => `${r.distance.replace(/\.\d+/, "")} ${r.name}`).join(", ")} at ${e.venue.name}, ${e.city}.${
      e.cause ? ` ${e.cause}.` : ""
    }`,
    startDate: iso(start),
    endDate: iso(end),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url,
    image,
    location: {
      "@type": "Place",
      name: e.venue.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: e.venue.name,
        addressLocality: e.city,
        addressRegion: "Chhattisgarh",
        postalCode: e.venue.detail.match(/\b\d{6}\b/)?.[0],
        addressCountry: "IN",
      },
      ...(e.venue.lat != null && e.venue.lng != null
        ? { geo: { "@type": "GeoCoordinates", latitude: e.venue.lat, longitude: e.venue.lng } }
        : {}),
    },
    organizer: { "@type": "Organization", name: organiser.name, url: SITE_URL, email: organiser.email },
    ...(e.fees.length
      ? {
          offers: e.fees.map((f) => ({
            "@type": "Offer",
            name: `${f.title} registration`,
            price: f.price,
            priceCurrency: "INR",
            ...(f.tax ? { priceSpecification: { "@type": "PriceSpecification", price: f.price, priceCurrency: "INR", valueAddedTaxIncluded: false } } : {}),
            url: registerUrl,
            availability,
            ...(e.registrationDeadlineDate ? { validThrough: e.registrationDeadlineDate } : {}),
          })),
        }
      : {}),
    subEvent: e.races
      .filter((r) => r.start)
      .map((r) => ({
        "@type": "SportsEvent",
        name: `${r.name} ${r.distance.replace(/\.\d+/, "")}`,
        startDate: (() => {
          const m = r.start!.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (!m) return iso(start);
          const h = (+m[1] % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
          const day = e.date.slice(0, 10);
          return `${day}T${String(h).padStart(2, "0")}:${m[2]}:00${e.date.slice(19) || "+05:30"}`;
        })(),
        location: { "@type": "Place", name: e.venue.name, address: `${e.venue.name}, ${e.venue.detail}` },
      })),
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
