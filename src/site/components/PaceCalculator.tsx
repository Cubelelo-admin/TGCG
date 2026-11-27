"use client";

import { useMemo, useState } from "react";

export type PaceDistance = {
  label: string;
  km: number; // distance used for the maths (measured from the course GPX when available)
  cutoffMin?: number | null;
  color?: string;
  // From the course GPX (only for races with a track file)
  track?: { name?: string; climbM: number; uturnsKm: number[]; mapHref?: string };
  startMin?: number | null; // race start as minutes after midnight, for clock times
  timeline?: { assemble?: string; warmup?: string; start?: string; endBy?: string }; // race-morning times
};

function minToClock(min: number) {
  const t = Math.round(min) % (24 * 60);
  const h = Math.floor(t / 60), mm = t % 60;
  return `${((h + 11) % 12) + 1}:${pad(mm)} ${h < 12 ? "AM" : "PM"}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
function hms(totalSec: number) {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

function NumberField({ label, value, onChange, max }: { label: string; value: number; onChange: (n: number) => void; max: number }) {
  return (
    <label className="num-field">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        onChange={(ev) => onChange(Math.max(0, Math.min(max, Number(ev.target.value) || 0)))}
      />
      <span>{label}</span>
    </label>
  );
}

// A realistic starting goal for a distance (marathon 4:00, half 2:00, 10K 1:00, 6K 0:40),
// kept inside the cut-off so the first result a runner sees isn't a failed cut-off.
function defaultGoal(d?: PaceDistance) {
  if (!d) return { h: 1, m: 0 };
  let min = d.km > 30 ? 240 : d.km > 15 ? 120 : d.km > 7 ? 60 : 40;
  if (d.cutoffMin && min > d.cutoffMin) min = Math.floor(d.cutoffMin * 0.85);
  return { h: Math.floor(min / 60), m: min % 60 };
}

export default function PaceCalculator({ distances }: { distances: PaceDistance[] }) {
  const [di, setDi] = useState(0);
  const [mode, setMode] = useState<"time" | "pace">("time");
  const [h, setH] = useState(() => defaultGoal(distances[0]).h);
  const [m, setM] = useState(() => defaultGoal(distances[0]).m);
  const [s, setS] = useState(0);
  const pickDistance = (i: number) => {
    setDi(i);
    const g = defaultGoal(distances[i]);
    setH(g.h);
    setM(g.m);
    setS(0);
  };
  const [pm, setPm] = useState(6);
  const [ps, setPs] = useState(0);

  const d = distances[di];

  const result = useMemo(() => {
    if (!d) return null;
    const totalSec = mode === "time" ? h * 3600 + m * 60 + s : (pm * 60 + ps) * d.km;
    if (totalSec <= 0) return null;
    const paceSec = totalSec / d.km;
    const kmh = d.km / (totalSec / 3600);
    // Checkpoints: every 5 km on long races, every 2 km on 10K, every km on shorter ones,
    // plus the U-turns at their real position on the track, halfway (marathon) and the finish.
    const every = d.km > 15 ? 5 : d.km > 7 ? 2 : 1;
    const pts: { km: number; label: string; kind?: "uturn" | "half" | "finish" }[] = [];
    for (let k = every; k < d.km - 0.3; k += every) pts.push({ km: k, label: `${k} km` });
    d.track?.uturnsKm.forEach((k, i, all) =>
      pts.push({ km: k, label: `↩ U-turn${all.length > 1 ? ` ${i + 1}` : ""} · ${k.toFixed(1)} km`, kind: "uturn" }),
    );
    if (d.km > 40) pts.push({ km: d.km / 2, label: `Halfway · ${(d.km / 2).toFixed(1)} km`, kind: "half" });
    pts.sort((a, b) => a.km - b.km);
    pts.push({ km: d.km, label: `Finish · ${d.km.toFixed(d.km % 1 ? 3 : 0)} km`, kind: "finish" });
    const splits = pts.map((p) => ({
      ...p,
      time: hms(paceSec * p.km),
      clock: d.startMin != null ? minToClock(d.startMin + (paceSec * p.km) / 60) : null,
    }));
    const cutoffSec = d.cutoffMin ? d.cutoffMin * 60 : null;
    return { totalSec, paceSec, kmh, splits, cutoffSec };
  }, [d, mode, h, m, s, pm, ps]);

  if (!d) return null;

  return (
    <div className="pace-calc">
      <fieldset className="pace-distances">
        <legend>Distance / दूरी</legend>
        {distances.map((x, i) => (
          <label key={x.label} className="chip-radio" style={{ "--race": x.color ?? "var(--brand)" } as React.CSSProperties}>
            <input type="radio" name="distance" checked={i === di} onChange={() => pickDistance(i)} />
            <span>{x.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="pace-tabs" role="tablist" aria-label="Calculate from">
        <button type="button" role="tab" aria-selected={mode === "time"} onClick={() => setMode("time")}>
          I know my target time
        </button>
        <button type="button" role="tab" aria-selected={mode === "pace"} onClick={() => setMode("pace")}>
          I know my pace
        </button>
      </div>

      <div className="pace-inputs">
        {mode === "time" ? (
          <>
            <NumberField label="hours" value={h} onChange={setH} max={12} />
            <NumberField label="min" value={m} onChange={setM} max={59} />
            <NumberField label="sec" value={s} onChange={setS} max={59} />
          </>
        ) : (
          <>
            <NumberField label="min / km" value={pm} onChange={setPm} max={20} />
            <NumberField label="sec" value={ps} onChange={setPs} max={59} />
          </>
        )}
      </div>

      {result && (
        <div className="pace-result" aria-live="polite">
          <div className="pace-big">
            <div>
              <span className="meta-label">Pace</span>
              <strong>{hms(result.paceSec)}</strong>
              <span>min / km</span>
            </div>
            <div>
              <span className="meta-label">Finish time</span>
              <strong>{hms(result.totalSec)}</strong>
              <span>h:mm:ss</span>
            </div>
            <div>
              <span className="meta-label">Speed</span>
              <strong>{result.kmh.toFixed(1)}</strong>
              <span>km / h</span>
            </div>
          </div>

          {result.cutoffSec && (
            <p className={`pace-cutoff ${result.totalSec <= result.cutoffSec ? "ok" : "bad"}`}>
              {result.totalSec <= result.cutoffSec
                ? `✓ Inside the ${hms(result.cutoffSec)} cut-off, with ${hms(result.cutoffSec - result.totalSec)} to spare.`
                : `✗ ${hms(result.totalSec - result.cutoffSec)} slower than the ${hms(result.cutoffSec)} cut-off. You'd need ${hms(result.cutoffSec / d.km)} min/km or faster.`}
            </p>
          )}

          {d.timeline && d.startMin != null && (
            <ol className="pace-timeline" aria-label="Your race timeline">
              {d.timeline.assemble && (
                <li>
                  <b>{d.timeline.assemble}</b>Assemble
                </li>
              )}
              {d.timeline.warmup && (
                <li>
                  <b>{d.timeline.warmup}</b>Warm-up
                </li>
              )}
              <li>
                <b>{d.timeline.start}</b>Start
              </li>
              <li className="you">
                <b>{minToClock(d.startMin + result.totalSec / 60)}</b>You finish
              </li>
              {d.timeline.endBy && (
                <li>
                  <b>{d.timeline.endBy}</b>Course closes
                </li>
              )}
            </ol>
          )}

          {d.track && (
            <p className="pace-track-note">
              📍 <strong>Calculated on the actual {d.track.name ?? "race"} track:</strong> {d.km.toFixed(d.km % 1 ? 3 : 0)} km
              measured from the course GPX
              {d.track.uturnsKm.length
                ? `, U-turn${d.track.uturnsKm.length > 1 ? "s" : ""} at ${d.track.uturnsKm.map((k) => `${k.toFixed(1)} km`).join(" & ")}`
                : ", loop course"}
              , total climb +{d.track.climbM} m.
              <span className="hi">यह गणना असली रेस ट्रैक (GPX) के अनुसार है।</span>
              {d.track.mapHref && (
                <a href={d.track.mapHref} className="link">
                  See it on the course map →
                </a>
              )}
            </p>
          )}

          <table className="splits">
            <caption>
              {d.track ? "Your checkpoints on the track at even pace" : "Split times at even pace"}
            </caption>
            {result.splits.some((sp) => sp.clock) && (
              <thead>
                <tr>
                  <th scope="col">Point</th>
                  <th scope="col">Elapsed</th>
                  <th scope="col">Clock time</th>
                </tr>
              </thead>
            )}
            <tbody>
              {result.splits.map((sp) => (
                <tr key={sp.label} className={sp.kind ? `split-${sp.kind}` : undefined}>
                  <th scope="row">{sp.label}</th>
                  <td>{sp.time}</td>
                  {sp.clock && <td className="split-clock">{sp.clock}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
