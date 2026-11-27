import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/site/components/PageHero";
import RegisterCta from "@/site/components/RegisterCta";
import YouTube from "@/site/components/YouTube";
import { raipur, raipurExtras } from "@/site/content/raipur";
import { clockToMin } from "@/site/lib/event";
import { readTrack, stationPasses } from "@/site/lib/gpx";

export const metadata: Metadata = {
  title: "Comrades Qualifier",
  description: "A World Athletics measured 42.195 km course in Nava Raipur: 2 × 21.1 km laps, flat profile, aid every 3 km or less.",
};

const fmtKm = (km: number) => (Math.round(km * 10) / 10).toString();
const hms = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
};
const clock = (min: number) => {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  return `${((h + 11) % 12) + 1}:${String(t % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const pace = (min: number, km: number) => {
  const s = Math.round((min / km) * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Finish-time targets for the pace table. Comrades asks for an official marathon in under 5 hours.
const targets = [
  { label: "Qualify", min: 299, note: "Under 5:00, the Comrades qualifying standard" },
  { label: "Better seeding", min: 270, note: "Sub-4:30" },
  { label: "Strong seeding", min: 240, note: "Sub-4:00" },
  { label: "Front pens", min: 210, note: "Sub-3:30" },
];

export default function ComradesPage() {
  const marathon = raipur.races.find((r) => r.slug === "marathon")!;
  const official = marathon.km ?? 42.195;
  const track = marathon.gpx ? readTrack(marathon.gpx) : null;
  const configPath = raipur.courseMap?.replace(/index\.html$/, "data/config.js");
  const aid = configPath && marathon.gpx && marathon.courseMapId ? stationPasses(configPath, marathon.gpx, marathon.courseMapId) : [];
  const lapKm = official / 2;
  const uturns = track?.uturnsKm ?? [];
  const startMin = clockToMin(marathon.start) ?? 240;

  // Longest stretch without an aid point (start/finish line counts: 0, half, finish)
  const aidKms = [0, ...aid.map((a) => a.km), lapKm, official].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < aidKms.length; i++) maxGap = Math.max(maxGap, aidKms[i]! - aidKms[i - 1]!);

  const specs: { k: string; v: string; sub?: string }[] = [
    { k: "Distance", v: `${official} km`, sub: "World Athletics measured course" },
    { k: "Format", v: "2 × 21.1 km", sub: "Out-and-back lap, run twice" },
    { k: "U-turns", v: uturns.length ? uturns.map(fmtKm).join(" & ") + " km" : "2", sub: "Wide 180° turnarounds" },
    ...(track
      ? [
          { k: "Total climb", v: `+${track.climbM} m`, sub: `${(track.climbM / official).toFixed(1)} m per km` },
          { k: "Elevation", v: `${track.minEle}–${track.maxEle} m`, sub: `Only ${track.maxEle - track.minEle} m between lowest and highest point` },
        ]
      : []),
    ...(aid.length ? [{ k: "Aid points", v: `${aid.length + 1}`, sub: `On course + start/finish · max gap ${maxGap.toFixed(1)} km` }] : []),
    { k: "Flag-off", v: marathon.start ?? "4:00 AM", sub: "Cool pre-dawn December start" },
    { k: "Cut-off", v: marathon.cutoff ?? "", sub: `Course closes ${marathon.endBy ?? ""}` },
  ];

  // Elevation chart geometry
  const W = 800;
  const H = 170;
  const pad = { t: 14, b: 26 };
  let chart: { line: string; area: string; y: (e: number) => number; lo: number; hi: number } | null = null;
  if (track && track.profile.length > 1) {
    const lo = track.minEle - 4;
    const hi = track.maxEle + 4;
    const x = (km: number) => (km / track.km) * W;
    const y = (e: number) => pad.t + (1 - (e - lo) / (hi - lo)) * (H - pad.t - pad.b);
    const line = track.profile.map(([km, e], i) => `${i ? "L" : "M"}${x(km).toFixed(1)},${y(e).toFixed(1)}`).join(" ");
    chart = { line, area: `${line} L${W},${H - pad.b} L0,${H - pad.b} Z`, y, lo, hi };
  }
  const xKm = (km: number) => (km / (track?.km ?? official)) * 100; // % across

  return (
    <>
      <PageHero
        eyebrow="Comrades Marathon qualifier · World Athletics measured"
        title="Chasing Comrades? This is it."
        subtitle="A flat, fast, accurately measured 42.195 km in Nava Raipur. Run your qualifier, and your best seeding time, at TGCG.run."
      >
        <div className="hero-actions">
          <Link href={`${raipur.basePath}/register`} className="btn btn-primary">
            Register for the marathon
          </Link>
          <Link href={`${raipur.basePath}/course-map#${marathon.courseMapId ?? ""}`} className="btn btn-ghost">
            Explore the 42K course
          </Link>
        </div>
      </PageHero>

      {/* ---------- Spec sheet ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow">Course data · from the official GPX</p>
            <h2>The 42K in numbers</h2>
          </div>
          <dl className="cq-specs reveal">
            {specs.map((s) => (
              <div key={s.k} className="cq-spec">
                <dt>{s.k}</dt>
                <dd>{s.v}</dd>
                {s.sub && <span>{s.sub}</span>}
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- Lap diagram + elevation ---------- */}
      <section className="section section-navy section-texture">
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow">How the course works</p>
            <h2>Two laps. Same road. No surprises.</h2>
            <p>
              Out to the U-turn at {fmtKm(uturns[0] ?? 10.55)} km, back through the start/finish at {fmtKm(lapKm)} km, then
              repeat. You see every kilometre twice, so lap 2 has no unknowns, and your crew can meet you at halfway.
            </p>
          </div>

          <div className="cq-laps reveal" aria-label="Lap diagram">
            <div className="cq-bar">
              {[1, 2].map((lap) => (
                <span key={lap} className="cq-lap" style={{ left: `${(lap - 1) * 50}%` }}>
                  Lap {lap}
                </span>
              ))}
              {aid.map((a, i) => (
                <i key={i} className="cq-aid" style={{ left: `${xKm(a.km)}%` }} title={`${a.name} · km ${fmtKm(a.km)}`} />
              ))}
              {uturns.map((u) => (
                <b key={u} className="cq-mark cq-ut" style={{ left: `${xKm(u)}%` }}>
                  ↩ {fmtKm(u)}
                </b>
              ))}
              <b className="cq-mark cq-sf" style={{ left: "0%" }}>
                🏁 Start
              </b>
              <b className="cq-mark cq-sf" style={{ left: "50%" }}>
                {fmtKm(lapKm)} · halfway
              </b>
              <b className="cq-mark cq-sf" style={{ left: "100%" }}>
                {official} Finish
              </b>
            </div>
            <p className="cq-legend">
              <span>
                <i className="cq-aid-key" /> Aid point
              </span>
              <span>↩ U-turn</span>
              <span>🏁 Start / finish line (all facilities)</span>
            </p>
          </div>

          {chart && track && (
            <figure className="cq-elev reveal">
              <figcaption>
                Elevation profile <span>{track.minEle}–{track.maxEle} m · +{track.climbM} m total climb</span>
              </figcaption>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Elevation between ${track.minEle} and ${track.maxEle} metres`}>
                <defs>
                  <linearGradient id="cqg" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#f5c400" stopOpacity="0.55" />
                    <stop offset="1" stopColor="#f5c400" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[chart.lo + 4, track.maxEle].map((e) => (
                  <g key={e}>
                    <line x1="0" x2={W} y1={chart!.y(e)} y2={chart!.y(e)} className="cq-grid" />
                  </g>
                ))}
                <line x1={W / 2} x2={W / 2} y1={pad.t} y2={H - pad.b} className="cq-half" />
                <path d={chart.area} fill="url(#cqg)" />
                <path d={chart.line} className="cq-line" vectorEffect="non-scaling-stroke" />
                {[0, 10, 20, 30, 40].map((k) => (
                  <text key={k} x={(k / track.km) * W} y={H - 8} className="cq-tick" textAnchor={k ? "middle" : "start"}>
                    {k} km
                  </text>
                ))}
              </svg>
              <p className="cq-elev-note">
                Vertical scale is exaggerated: the whole course sits within {track.maxEle - track.minEle} m. Shown with the official
                GPX, the same file used by the course map and pace calculator.
              </p>
            </figure>
          )}
        </div>
      </section>

      {/* ---------- Pace table ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow">Pace plan · flag-off {marathon.start}</p>
            <h2>What your qualifier looks like</h2>
            <p className="muted">
              Even splits on {official} km. Your seeding at Comrades depends on your qualifying time, so a faster marathon here
              moves you closer to the front.
            </p>
          </div>
          <div className="table-wrap reveal">
            <table className="cq-pace">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Pace / km</th>
                  <th>Halfway ({fmtKm(lapKm)} km)</th>
                  <th>Finish clock</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t, i) => (
                  <tr key={t.min} className={i === 0 ? "cq-qualify" : undefined}>
                    <td>
                      <strong>{t.label}</strong>
                      <span>{t.note}</span>
                    </td>
                    <td>
                      <b>{pace(t.min, official)}</b>
                    </td>
                    <td>
                      {hms(t.min / 2)} <span>at {clock(startMin + t.min / 2)}</span>
                    </td>
                    <td>
                      <b>{clock(startMin + t.min)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Qualifying rules, windows and seeding are set by the Comrades Marathon Association. Please confirm the current
            requirements on the official Comrades website before you plan.{" "}
            <Link href={`${raipur.basePath}/pace-calculator`} className="link">
              Make your own plan in the pace calculator →
            </Link>
          </p>
        </div>
      </section>

      {/* ---------- Why + video ---------- */}
      <section className="section section-sand">
        <div className="container split">
          <div>
            <p className="eyebrow">Why runners choose TGCG.run</p>
            <h2>Built for your qualifier</h2>
            <ul className="check-list dark">
              <li>
                <strong>Measured, not estimated:</strong> a World Athletics measured course since 2019, so your time counts.
              </li>
              <li>
                <strong>Flat and fast:</strong> 2 × 21.1 km on wide, smooth Nava Raipur roads
                {track ? `, with only ${track.maxEle - track.minEle} m between the lowest and highest point` : ""}.
              </li>
              <li>
                <strong>Cool start:</strong> flag-off at {marathon.start} on a December morning, so the first half is run before sunrise.
              </li>
              <li>
                <strong>Supported all the way:</strong>
                {aid.length ? ` ${aid.length} aid points on course, never more than ${maxGap.toFixed(1)} km apart, plus` : ""} full facilities at the start/finish line you pass at halfway.
              </li>
              <li>
                <strong>Technically free:</strong> registered for Comrades 2027? Register here, show your Comrades registration
                proof, and we refund your full fee.
              </li>
            </ul>
          </div>
          <YouTube id={raipurExtras.comradesVideo} title="Comrades qualifier at TGCG.run" />
        </div>
      </section>

      {/* ---------- Aid list ---------- */}
      {aid.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">On-course support · 42K</p>
              <h2>Where you&apos;ll find aid</h2>
            </div>
            <ol className="cq-aidlist reveal">
              {[...aid, { km: lapKm, name: "Start / Finish line · halfway", items: ["All start-line facilities"] }]
                .sort((a, b) => a.km - b.km)
                .map((a) => (
                  <li key={`${a.name}-${a.km}`}>
                    <span className="cq-aid-km">{fmtKm(a.km)}</span>
                    <div>
                      <strong>{a.items.includes("Recharge Station") ? "⚡ Recharge" : a.items.includes("Hydration") ? "💧 Hydration" : "🏁 Halfway"}</strong>
                      {(() => {
                        const rest = a.items.filter((x) => x !== "Recharge Station" && !(x === "Hydration" && !a.items.includes("Recharge Station")));
                        return rest.length ? <span>{rest.join(" · ")}</span> : null;
                      })()}
                    </div>
                  </li>
                ))}
            </ol>
            <div className="center mt">
              <Link href={`${raipur.basePath}/course-map#${marathon.courseMapId ?? ""}`} className="btn btn-dark">
                See every station on the course map →
              </Link>
            </div>
          </div>
        </section>
      )}

      <RegisterCta e={raipur} />
    </>
  );
}
