import Link from "next/link";
import CourseMapFrame from "@/site/components/CourseMapFrame";
import PageHero from "@/site/components/PageHero";
import RegisterCta from "@/site/components/RegisterCta";
import { directionsUrl, hasVenueMap } from "@/site/components/VenueMap";
import type { EventConfig } from "@/site/content/types";
import { waLink } from "@/site/lib/event";
import { stationPasses } from "@/site/lib/gpx";

export default function CourseMapView({ e }: { e: EventConfig }) {
  // Does the map's config already have water stations / aid points for any route?
  const configPath = e.courseMap?.replace(/index\.html$/, "data/config.js");
  const hasStations = Boolean(
    configPath && e.races.some((r) => r.gpx && r.courseMapId && stationPasses(configPath, r.gpx, r.courseMapId).length > 0),
  );
  return (
    <>
      <PageHero
        eyebrow={`${e.dateLabel} · ${e.venue.name}`}
        title="Course map"
        subtitle="Every route with km markers, U-turns, elevation and parking. Pick your distance below. सभी दौड़ों का रूट मैप।"
      >
        <div className="hero-actions">
          {e.courseMap && (
            <a href={e.courseMap} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Open full screen ↗
            </a>
          )}
          {hasVenueMap(e) && (
            <a href={directionsUrl(e)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Directions to the start ↗
            </a>
          )}
        </div>
      </PageHero>

      <section className="section course-map-section">
        <div className="container">
          {e.courseMap ? (
            <>
              <CourseMapFrame src={e.courseMap} title={`${e.shortName} interactive course map`} />
              <p className="muted center mt">
                {hasStations
                  ? "Tap a water station or aid point on the map to see what's there."
                  : "Water stations and km-wise facilities will be added to the map before race day."}{" "}
                <Link href={`${e.basePath}/race-day`} className="link">
                  Race-day guide →
                </Link>
              </p>
            </>
          ) : (
            <div className="coming-soon">
              <span className="coming-soon-icon" aria-hidden="true">🗺️</span>
              <strong>The course map will be published once the route is finalised.</strong>
              <span className="hi">रूट तय होते ही मैप यहाँ उपलब्ध होगा।</span>
              <a
                href={waLink(e, `Hi, please send me the ${e.shortName} route map when it's ready.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-dark mt"
              >
                Get it on WhatsApp
              </a>
            </div>
          )}
        </div>
      </section>

      <RegisterCta e={e} />
    </>
  );
}
