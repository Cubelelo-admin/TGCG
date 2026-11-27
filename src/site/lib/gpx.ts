// Server-only (uses the file system): import it from server components such as views/PaceView.tsx.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

// Reads a course GPX file (from /public) at build time and measures it the same way the
// interactive course map does: distance along the track, total climb and U-turn points.

export type TrackInfo = {
  km: number; // length measured along the GPX track
  climbM: number; // total ascent (m)
  uturnsKm: number[]; // km at which each U-turn is reached (in running order)
  minEle: number;
  maxEle: number;
  profile: [number, number][]; // [km, elevation m] every ~250 m, for elevation charts
  path: [number, number][]; // [lat, lng] every ~100 m, for drawing the route outline
};

const R = 6371000;
const rad = Math.PI / 180;
type Pt = [number, number, number]; // lat, lng, ele

function hav(a: Pt | [number, number], b: Pt | [number, number]) {
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function bearing(a: Pt, b: Pt) {
  const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
  const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

type Parsed = { pts: Pt[]; cum: number[] };
const parsedCache = new Map<string, Parsed | null>();

function parse(publicPath: string): Parsed | null {
  if (parsedCache.has(publicPath)) return parsedCache.get(publicPath)!;
  let out: Parsed | null = null;
  try {
    const xml = fs.readFileSync(path.join(process.cwd(), "public", publicPath), "utf8");
    const pts: Pt[] = [];
    for (const m of xml.matchAll(/<(?:trkpt|rtept)\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"[^>]*>(?:\s*<ele>([-\d.]+)<\/ele>)?/g)) {
      pts.push([+m[1], +m[2], m[3] != null ? +m[3] : 0]);
    }
    if (pts.length > 1) {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]));
      out = { pts, cum };
    }
  } catch {
    out = null;
  }
  parsedCache.set(publicPath, out);
  return out;
}

function pointAt({ pts, cum }: Parsed, m: number): Pt {
  let lo = 0;
  let hi = cum.length - 1;
  m = Math.max(0, Math.min(cum[hi], m));
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= m) lo = mid;
    else hi = mid;
  }
  const t = (m - cum[lo]) / (cum[hi] - cum[lo] || 1);
  const a = pts[lo];
  const b = pts[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const cache = new Map<string, TrackInfo | null>();

// publicPath: e.g. "/events/raipur/course-map/gpx/42KM Marathon.gpx"
export function readTrack(publicPath: string): TrackInfo | null {
  if (cache.has(publicPath)) return cache.get(publicPath)!;
  const p = parse(publicPath);
  let info: TrackInfo | null = null;
  if (p) {
    const { pts, cum } = p;
    let climb = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i][2] - pts[i - 1][2];
      if (d > 0) climb += d;
    }
    // U-turn = direction reverses (~180°) away from the start/finish area (same rule as the course map)
    const uturnsKm: number[] = [];
    for (let i = 1; i < pts.length - 1; i++) {
      if (hav(pts[i - 1], pts[i]) < 1 || hav(pts[i], pts[i + 1]) < 1 || hav(pts[0], pts[i]) < 300) continue;
      let d = Math.abs(bearing(pts[i - 1], pts[i]) - bearing(pts[i], pts[i + 1]));
      if (d > 180) d = 360 - d;
      if (d > 170) uturnsKm.push(cum[i] / 1000);
    }
    const total = cum[cum.length - 1];
    // Fallback for gentle turnarounds the bearing test misses: if the way back retraces the way out
    // (points at m and total−m stay close), the turnaround is at halfway.
    if (!uturnsKm.length && total > 1000) {
      const close = [0.15, 0.3, 0.4].every((f) => hav(pointAt(p, total * f), pointAt(p, total * (1 - f))) < 60);
      if (close) uturnsKm.push(total / 2000);
    }
    const profile: [number, number][] = [];
    for (let m = 0; m < total; m += 250) profile.push([m / 1000, pointAt(p, m)[2]]);
    profile.push([total / 1000, pts[pts.length - 1][2]]);
    const routePath: [number, number][] = [];
    for (let m = 0; m < total; m += 100) {
      const q = pointAt(p, m);
      routePath.push([q[0], q[1]]);
    }
    routePath.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
    const eles = pts.map((x) => x[2]);
    info = {
      km: total / 1000,
      climbM: Math.round(climb),
      uturnsKm,
      minEle: Math.round(Math.min(...eles)),
      maxEle: Math.round(Math.max(...eles)),
      profile,
      path: routePath,
    };
  }
  cache.set(publicPath, info);
  return info;
}

// ---------- Course stations (from the interactive map's data/config.js) ----------

export type StationPass = { km: number; name: string; items: string[] };
type CfgStation = { name: string; lat?: number; lng?: number; races?: string[]; items?: string[] };

// Every point along a race's GPX where it passes a station from the course map config (same 80 m rule as the map).
export function stationPasses(configPublicPath: string, gpxPublicPath: string, raceId: string): StationPass[] {
  const p = parse(gpxPublicPath);
  if (!p) return [];
  let stations: CfgStation[] = [];
  try {
    const src = fs.readFileSync(path.join(process.cwd(), "public", configPublicPath), "utf8");
    const sandbox = { window: {} as { CONFIG?: { stations?: CfgStation[] } } };
    vm.runInNewContext(src, sandbox, { timeout: 500 });
    stations = sandbox.window.CONFIG?.stations ?? [];
  } catch {
    return [];
  }
  const total = p.cum[p.cum.length - 1];
  const out: StationPass[] = [];
  for (const s of stations) {
    if (s.lat == null || s.lng == null || (s.races && !s.races.includes(raceId))) continue;
    let group: { last: number; bestM: number; bestD: number } | null = null;
    const flush = () => group && out.push({ km: group.bestM / 1000, name: s.name, items: s.items ?? [] });
    for (let m = 0; m <= total; m += 20) {
      const d = hav(pointAt(p, m), [s.lat, s.lng]);
      if (d >= 80) continue;
      if (group && m - group.last <= 300) {
        group.last = m;
        if (d < group.bestD) Object.assign(group, { bestM: m, bestD: d });
      } else {
        flush();
        group = { last: m, bestM: m, bestD: d };
      }
    }
    flush();
  }
  return out.sort((a, b) => a.km - b.km);
}
