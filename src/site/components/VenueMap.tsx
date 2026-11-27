import type { EventConfig } from "@/site/content/types";

export function hasVenueMap(e: EventConfig) {
  return e.venue.lat !== undefined && e.venue.lng !== undefined;
}

export function directionsUrl(e: EventConfig) {
  return `https://www.google.com/maps/dir/?api=1&destination=${e.venue.lat},${e.venue.lng}`;
}

export default function VenueMap({ e }: { e: EventConfig }) {
  const { lat, lng, bbox } = e.venue;
  if (lat === undefined || lng === undefined) return null;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox ?? `${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}`}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="map">
      <iframe src={src} title={`${e.venue.name} map`} loading="lazy" />
    </div>
  );
}
