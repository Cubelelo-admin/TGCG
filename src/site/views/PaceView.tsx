import PaceCalculator, { type PaceDistance } from "@/site/components/PaceCalculator";
import PageHero from "@/site/components/PageHero";
import RegisterCta from "@/site/components/RegisterCta";
import type { EventConfig } from "@/site/content/types";
import { readTrack } from "@/site/lib/gpx";
import { clockToMin, cutoffMinutes, raceKm } from "@/site/lib/event";

const standard: PaceDistance[] = [
  { label: "5 KM", km: 5 },
  { label: "10 KM", km: 10 },
  { label: "Half (21.1 KM)", km: 21.0975 },
  { label: "Marathon (42.2 KM)", km: 42.195 },
];

export default function PaceView({ e }: { e: EventConfig }) {
  const distances: PaceDistance[] = e.races.length
    ? e.races
        .map((r) => {
          // Measure the race on its course GPX (distance, U-turns, climb); fall back to the official distance
          const t = r.gpx ? readTrack(r.gpx) : null;
          return {
            label: `${r.name} · ${r.distance}`,
            km: t ? t.km : raceKm(r),
            cutoffMin: cutoffMinutes(r.cutoff),
            color: r.color,
            startMin: clockToMin(r.start),
            timeline: r.start ? { assemble: r.assemble, warmup: r.warmup, start: r.start, endBy: r.endBy } : undefined,
            track: t
              ? {
                  name: [r.track, r.name].filter(Boolean).join(" · "),
                  climbM: t.climbM,
                  uturnsKm: t.uturnsKm,
                  mapHref: e.courseMap && r.courseMapId ? `${e.basePath}/course-map#${r.courseMapId}` : undefined,
                }
              : undefined,
          };
        })
        .filter((d) => d.km > 0)
    : standard;
  const onTrack = distances.some((d) => d.track);

  return (
    <>
      <PageHero
        eyebrow="Plan your race"
        title="Pace calculator"
        subtitle={
          onTrack
            ? `Pick your race, enter a goal time or pace, and get your checkpoints on the actual ${e.city} course: km splits, U-turns and the clock time you'll reach each one. अपनी गति की योजना बनाएँ।`
            : "Pick a distance, enter a goal time or pace, and get your splits. Checks the cut-off for every race. अपनी गति की योजना बनाएँ।"
        }
      />
      <section className="section">
        <div className="container narrow">
          <PaceCalculator distances={distances.length ? distances : standard} />
        </div>
      </section>
      <RegisterCta e={e} />
    </>
  );
}
