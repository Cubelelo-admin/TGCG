// Builds the Raigarh course map tracks from ONE outbound leg:
//   gpx/raigarh/source/raigarh 10.5.gpx = Start (Mini Stadium) -> U-turn (one way, ~10.5 km)
//   21K = out + back (U-turn moved along the road so the loop is exactly 21.0975 km)
//   10K = out 5 km + back,  6K = out 3 km + back (same road)
// Elevation comes from the Open-Meteo elevation API (only route coordinates are sent) and is cached in
// gpx/raigarh/elevation.json, so later rebuilds work offline.
// Writes public/events/raigarh/course-map/gpx/*.gpx and data/routes.js.
// Run: node course-map-tools/build-raigarh.js
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "..", "public", "events", "raigarh", "course-map");
const GPX = path.join(SITE, "gpx");
const WORK = path.join(__dirname, "gpx", "raigarh");
const SRC = path.join(WORK, "source", "raigarh 10.5.gpx");
const ELE_CACHE = path.join(WORK, "elevation.json");
const LOOP = 21097.5, DENSIFY = 50; // metres

const R = 6371000, rad = Math.PI / 180;
const hav = (a, b) => { const dLat = (b[0]-a[0])*rad, dLon = (b[1]-a[1])*rad; const s = Math.sin(dLat/2)**2 + Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(s)); };
const brg = (a, b) => { const y = Math.sin((b[1]-a[1])*rad)*Math.cos(b[0]*rad); const x = Math.cos(a[0]*rad)*Math.sin(b[0]*rad) - Math.sin(a[0]*rad)*Math.cos(b[0]*rad)*Math.cos((b[1]-a[1])*rad); return Math.atan2(y, x); };
const dest = (p, b, d) => { const la = p[0]*rad, lo = p[1]*rad, dr = d/R; const la2 = Math.asin(Math.sin(la)*Math.cos(dr) + Math.cos(la)*Math.sin(dr)*Math.cos(b)); const lo2 = lo + Math.atan2(Math.sin(b)*Math.sin(dr)*Math.cos(la), Math.cos(dr) - Math.sin(la)*Math.sin(la2)); return [la2/rad, lo2/rad]; };
const len = (p) => p.reduce((s, q, i) => i ? s + hav(p[i-1], q) : 0, 0);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const read = (f) => [...fs.readFileSync(f, "utf8").matchAll(/<trkpt\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"/g)].map((m) => [+m[1], +m[2]]);

function cut(p, d) {
  const out = [p[0]]; let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const s = hav(p[i-1], p[i]);
    if (acc + s >= d) { out.push(lerp(p[i-1], p[i], (d - acc) / s)); return out; }
    acc += s; out.push(p[i]);
  }
  return out;
}
function densify(p) {
  const out = [p[0]];
  for (let i = 1; i < p.length; i++) {
    const n = Math.ceil(hav(p[i-1], p[i]) / DENSIFY);
    for (let k = 1; k <= n; k++) out.push(lerp(p[i-1], p[i], k / n));
  }
  return out;
}

async function elevations(pts) {
  const key = (q) => `${q[0].toFixed(5)},${q[1].toFixed(5)}`;
  const cache = fs.existsSync(ELE_CACHE) ? JSON.parse(fs.readFileSync(ELE_CACHE, "utf8")) : {};
  const missing = [...new Set(pts.map(key).filter((k) => cache[k] == null))];
  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100);
    const lat = batch.map((k) => k.split(",")[0]).join(","), lon = batch.map((k) => k.split(",")[1]).join(",");
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
    if (!r.ok) throw new Error(`Elevation API ${r.status}`);
    const j = await r.json();
    batch.forEach((k, n) => { cache[k] = j.elevation[n]; });
    await new Promise((res) => setTimeout(res, 400));
  }
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(ELE_CACHE, JSON.stringify(cache));
  // Smooth with a ~450 m moving average: the elevation model (~90 m cells) adds steps that would
  // otherwise inflate "total climb" on a course this flat
  const raw = pts.map((q) => cache[key(q)]);
  const W = 4;
  return raw.map((_, i) => {
    const s = raw.slice(Math.max(0, i - W), i + W + 1);
    return Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10;
  });
}

(async () => {
  // 1. outbound leg trimmed / extended so out + back = LOOP
  const raw = read(SRC);
  const half = LOOP / 2, srcLen = len(raw);
  let out;
  if (srcLen >= half) out = cut(raw, half);
  else {
    const n = raw.length - 1, b = brg(raw[n-1], raw[n]);
    let ext = half - srcLen;
    for (let k = 0; k < 20; k++) {
      out = raw.slice(0, n).concat([dest(raw[n], b, ext)]);
      const err = half - len(out);
      if (Math.abs(err) < 0.01) break;
      ext += err;
    }
  }
  out = densify(out);
  const ele = await elevations(out);
  out = out.map((q, i) => [q[0], q[1], ele[i]]);

  // 2. races
  const back = (p) => p.slice(0, -1).reverse();
  const outFor = (km) => { const c = cut(out, km * 1000); const e = c[c.length - 1]; if (e.length < 3 || e[2] == null) e[2] = out[c.length - 2][2]; return c; };
  const races = {
    "21KM Half Marathon.gpx": ["21K Half Marathon", out.concat(back(out))],
    "10KM Beginners Delight.gpx": ["10K Beginners Delight", (() => { const o = outFor(5); return o.concat(back(o)); })()],
    "6KM Dream Run.gpx": ["6K Dream Run", (() => { const o = outFor(3); return o.concat(back(o)); })()],
  };

  // 3. GPX + routes.js
  fs.mkdirSync(GPX, { recursive: true });
  fs.mkdirSync(path.join(SITE, "data"), { recursive: true });
  const gpx = (name, pts) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="build-raigarh.js" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>${name}</name><desc>TGCG Raigarh · generated from raigarh 10.5.gpx</desc></metadata>
<trk><name>${name}</name><trkseg>
${pts.map((q) => `<trkpt lat="${q[0].toFixed(7)}" lon="${q[1].toFixed(7)}"><ele>${q[2]}</ele></trkpt>`).join("\n")}
</trkseg></trk>
</gpx>
`;
  const lines = ["// AUTO-GENERATED by course-map-tools/build-raigarh.js. Do not edit by hand.", "window.ROUTES = {"];
  for (const [f, [name, pts]] of Object.entries(races)) {
    fs.writeFileSync(path.join(GPX, f), gpx(name, pts));
    lines.push(`  "${f}": [${pts.map((q) => `[${+q[0].toFixed(6)},${+q[1].toFixed(6)},${+q[2].toFixed(1)}]`).join(",")}],`);
    console.log(`${f}: ${(len(pts) / 1000).toFixed(4)} km, ${pts.length} pts`);
  }
  lines.push("};", "");
  fs.writeFileSync(path.join(SITE, "data", "routes.js"), lines.join("\n"));
  console.log(`Source leg ${(srcLen / 1000).toFixed(4)} km -> ${(len(out) / 1000).toFixed(4)} km one way. Start ${out[0].slice(0, 2).map((v) => v.toFixed(6))}`);
  console.log(`Elevation ${Math.min(...ele)}–${Math.max(...ele)} m`);
})().catch((e) => { console.error(e); process.exit(1); });
