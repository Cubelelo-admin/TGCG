// Builds the Track A GPX files (42K, 21K, 10K) from ONE outbound leg:
//   gpx/source/42new.gpx  = Start -> U-turn (one way)
//   21K = out + back (U-turn nudged so the loop is exactly 21.0975 km)
//   42K = 21K loop x 2
//   10K = out 5 km + back (same road)
// Elevation is borrowed from gpx/original/42KM Marathon.gpx (same roads).
// Run: node course-map-tools/build-tracks.js   then   powershell -ExecutionPolicy Bypass -File course-map-tools\build.ps1
const fs = require("fs"), path = require("path");
const GPX = path.join(__dirname, "..", "public", "events", "raipur", "course-map", "gpx"); // live GPX (output)
const WORK = path.join(__dirname, "gpx"); // private working files (not on the website)
const SRC = path.join(WORK, "source", "42new.gpx");
const ELE_SRC = path.join(WORK, "original", "42KM Marathon.gpx");
const LOOP = 21097.5, HALF_RACE = 10000, DENSIFY = 50; // metres

const R = 6371000, rad = Math.PI / 180;
const hav = (a, b) => { const dLat = (b[0]-a[0])*rad, dLon = (b[1]-a[1])*rad; const s = Math.sin(dLat/2)**2 + Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(s)); };
const brg = (a, b) => { const y = Math.sin((b[1]-a[1])*rad)*Math.cos(b[0]*rad); const x = Math.cos(a[0]*rad)*Math.sin(b[0]*rad) - Math.sin(a[0]*rad)*Math.cos(b[0]*rad)*Math.cos((b[1]-a[1])*rad); return Math.atan2(y, x); };
const dest = (p, b, d) => { const la = p[0]*rad, lo = p[1]*rad, dr = d/R; const la2 = Math.asin(Math.sin(la)*Math.cos(dr) + Math.cos(la)*Math.sin(dr)*Math.cos(b)); const lo2 = lo + Math.atan2(Math.sin(b)*Math.sin(dr)*Math.cos(la), Math.cos(dr) - Math.sin(la)*Math.sin(la2)); return [la2/rad, lo2/rad]; };
const len = (p) => p.reduce((s, q, i) => i ? s + hav(p[i-1], q) : 0, 0);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const read = (f) => [...fs.readFileSync(f, "utf8").matchAll(/<trkpt lat="([-\d.]+)" lon="([-\d.]+)"[^>]*>(?:\s*<ele>([-\d.]+)<\/ele>)?/g)].map((m) => [+m[1], +m[2], m[3] != null ? +m[3] : null]);

// cut a path at distance d (returns points from start up to d)
function cut(p, d) {
  const out = [p[0]]; let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const s = hav(p[i-1], p[i]);
    if (acc + s >= d) { out.push(lerp(p[i-1], p[i], (d - acc) / s)); return out; }
    acc += s; out.push(p[i]);
  }
  return out;
}
// insert points so no segment is longer than DENSIFY metres
function densify(p) {
  const out = [p[0]];
  for (let i = 1; i < p.length; i++) {
    const n = Math.ceil(hav(p[i-1], p[i]) / DENSIFY);
    for (let k = 1; k <= n; k++) out.push(lerp(p[i-1], p[i], k / n));
  }
  return out;
}

// 1. outbound leg, U-turn nudged along the road so out+back = LOOP
const raw = read(SRC).map((q) => [q[0], q[1]]);
const n = raw.length - 1, b = brg(raw[n-1], raw[n]);
let ext = (LOOP / 2) - len(raw), out;
for (let k = 0; k < 20; k++) {
  out = raw.slice(0, n).concat([dest(raw[n], b, ext)]);
  const err = LOOP / 2 - len(out);
  if (Math.abs(err) < 0.01) break;
  ext += err;
}
out = densify(out);

// 2. elevation from the old marathon track (dense resample, nearest neighbour)
const old = read(ELE_SRC), oldDense = [];
for (let i = 1; i < old.length; i++) {
  const s = Math.max(1, Math.ceil(hav(old[i-1], old[i]) / 10));
  for (let k = 0; k < s; k++) oldDense.push(lerp(old[i-1], old[i], k / s));
}
let maxGap = 0;
out = out.map((q) => {
  let best = null, bd = Infinity;
  for (const o of oldDense) { const d = hav(q, o); if (d < bd) { bd = d; best = o; } }
  maxGap = Math.max(maxGap, bd);
  return [q[0], q[1], Math.round(best[2] * 10) / 10];
});

// 3. assemble races
const back = (p) => p.slice(0, -1).reverse();
const loop21 = out.concat(back(out));
const loop42 = loop21.concat(loop21.slice(1));
const out10 = cut(out, HALF_RACE / 2);
const loop10 = out10.concat(back(out10));

// 4. write GPX
const gpx = (name, pts) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="build-tracks.js" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>${name}</name><desc>Generated from gpx/source/42new.gpx</desc></metadata>
<trk><name>${name}</name><trkseg>
${pts.map((q) => `<trkpt lat="${q[0].toFixed(7)}" lon="${q[1].toFixed(7)}"><ele>${q[2]}</ele></trkpt>`).join("\n")}
</trkseg></trk>
</gpx>
`;
const files = { "42KM Marathon.gpx": ["42K Marathon · Track A", loop42], "21KM Half Marathon.gpx": ["21K Half Marathon · Track A", loop21], "10KM Beginers Delight.gpx": ["10K Beginners Delight · Track A", loop10] };
for (const [f, [name, pts]] of Object.entries(files)) {
  fs.writeFileSync(path.join(GPX, f), gpx(name, pts));
  console.log(`${f}: ${(len(pts) / 1000).toFixed(4)} km, ${pts.length} pts`);
}
console.log(`Source leg ${(len(raw) / 1000).toFixed(4)} km; U-turn pushed ${ext.toFixed(1)} m; 10K U-turn at ${out10[out10.length-1].slice(0,2).map(v=>v.toFixed(6)).join(",")}`);
console.log(`Elevation: max distance to old track ${maxGap.toFixed(0)} m`);
