// Server component: home-page teaser for the interactive course map, drawn from the official GPX files.
import Link from "next/link";
import type { EventConfig } from "@/site/content/types";
import { readTrack, stationPasses } from "@/site/lib/gpx";

const fmtKm = (km: number) => (Math.round(km * 10) / 10).toString();
const FLAT_M = 15; // only call the course "flat & fast" when the whole route sits within this many metres
const short = (d: string) => d.replace(/\.\d+/, "").replace(" KM", "K");

export default function CoursePreview({ e }: { e: EventConfig }) {
  if (!e.courseMap) return null;
  const races = e.races
    .filter((r) => r.gpx && r.courseMapId)
    .map((r) => ({ r, t: readTrack(r.gpx!) }))
    .filter((x): x is { r: (typeof x)["r"]; t: NonNullable<(typeof x)["t"]> } => Boolean(x.t));
  if (!races.length) return null;

  const longest = races.reduce((a, b) => (b.t.km > a.t.km ? b : a));
  const configPath = e.courseMap.replace(/index\.html$/, "data/config.js");
  const aid = stationPasses(configPath, longest.r.gpx!, longest.r.courseMapId!);
  const tracks = [...new Set(races.map((x) => x.r.track).filter(Boolean))];
  const minEle = Math.min(...races.map((x) => x.t.minEle));
  const maxEle = Math.max(...races.map((x) => x.t.maxEle));

  // Project all routes into one SVG (equirectangular, fine at city scale)
  const all = races.flatMap((x) => x.t.path);
  const lats = all.map((p) => p[0]);
  const lngs = all.map((p) => p[1]);
  const [la0, la1, lo0, lo1] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const kx = Math.cos(((la0 + la1) / 2) * (Math.PI / 180));
  const w = (lo1 - lo0) * kx;
  const h = la1 - la0;
  const W = 400;
  const pad = 18;
  const s = (W - pad * 2) / Math.max(w, h);
  const H = Math.round(h * s + pad * 2);
  const xy = ([la, lo]: [number, number]) => [pad + (lo - lo0) * kx * s, pad + (la1 - la) * s] as const;
  const d = (path: [number, number][]) => path.map((p, i) => `${i ? "L" : "M"}${xy(p)[0].toFixed(1)},${xy(p)[1].toFixed(1)}`).join(" ");
  const start = xy(longest.t.path[0]);
  // Longest first, so shorter races on the same road sit on top as thinner lines
  const drawn = [...races].sort((a, b) => b.t.km - a.t.km);

  const facts = [
    { v: `${tracks.length || 1}`, k: tracks.length > 1 ? "tracks" : "track", sub: tracks.length > 1 ? tracks.join(" · ") : "" },
    { v: `${maxEle - minEle} m`, k: "elevation range", sub: `${minEle}–${maxEle} m${maxEle - minEle < FLAT_M ? ": flat & fast" : ""}` },
    ...(aid.length ? [{ v: `${aid.length + 1}`, k: `aid points on the ${short(longest.r.distance)}`, sub: "incl. start / finish line" }] : []),
    { v: "1", k: "start & finish", sub: e.venue.name },
  ];

  return (
    <section className="section course-preview">
      <div className="container cp-grid">
        <div className="reveal">
          <p className="eyebrow">The course · रूट</p>
          <h2>See every kilometre before race day</h2>
          <p className="lead">
            Measured from the official GPX: km markers, U-turns, elevation and every aid station on an interactive map.
          </p>
          <dl className="cp-facts">
            {facts.map((f) => (
              <div key={f.k}>
                <dd>{f.v}</dd>
                <dt>{f.k}</dt>
                {f.sub && <span>{f.sub}</span>}
              </div>
            ))}
          </dl>
          <div className="cp-races">
            {races.map(({ r, t }) => (
              <Link key={r.slug} href={`${e.basePath}/course-map#${r.courseMapId}`} style={{ "--race": r.color } as React.CSSProperties}>
                <strong>{short(r.distance)}</strong>
                <span>
                  {r.track ? `${r.track} · ` : ""}
                  {t.uturnsKm.length ? `U-turn ${t.uturnsKm.map(fmtKm).join(" & ")} km` : "loop"}
                </span>
              </Link>
            ))}
          </div>
          <Link href={`${e.basePath}/course-map`} className="btn btn-dark">
            Open the course map →
          </Link>
        </div>

        <Link href={`${e.basePath}/course-map`} className="cp-map reveal" aria-label="Open the interactive course map">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Route outline of ${races.length} races from ${e.venue.name}`}>
            {drawn.map(({ r, t }, i) => (
              <path key={r.slug} d={d(t.path)} stroke={r.color} strokeWidth={Math.max(2.5, 9 - i * 2)} className="cp-route" />
            ))}
            <circle cx={start[0]} cy={start[1]} r="7" className="cp-start" />
          </svg>
          <span className="cp-flag">🏁 {e.venue.name}</span>
          <span className="cp-open">Tap to explore ↗</span>
        </Link>
      </div>
    </section>
  );
}
