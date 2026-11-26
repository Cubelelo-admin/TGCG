// Usage: node scripts/generate-app-icons.cjs .   (writes public/app-icons/*; output is committed)
// Generates the installable-app icons for /admin and /v from public/logo.png (run once; output committed).
const sharp = require("module").createRequire(process.argv[2] + "/package.json")("sharp");
const path = require("path");
const root = process.argv[2];
const logo = path.join(root, "public/logo.png");
const out = (n) => path.join(root, "public/app-icons", n);
const DARK = "#0d121c";

async function logoAt(width, white) {
  let img = sharp(logo).resize({ width });
  if (white) {
    // Keep the logo's shape (alpha), paint it white.
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) { const ink = 255 - Math.min(data[i], data[i + 1], data[i + 2]); const a = Math.min(255, Math.round(ink * 1.7)) * (data[i + 3] / 255); data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = Math.round(a); }
    return sharp(data, { raw: info }).png().toBuffer();
  }
  return img.png().toBuffer();
}

async function make(size, kind, file, { flatten = false } = {}) {
  const white = kind === "volunteer";
  // Logo inside the maskable safe zone (centre 80% circle): 60% wide.
  const lw = Math.round(size * 0.6);
  const lbuf = await logoAt(lw, white);
  const lmeta = await sharp(lbuf).metadata();
  const top = Math.round((size - lmeta.height) / 2) - (kind === "admin" ? Math.round(size * 0.06) : 0);
  const layers = [{ input: lbuf, left: Math.round((size - lw) / 2), top }];
  if (kind === "admin") {
    const pw = Math.round(size * 0.36), ph = Math.round(size * 0.1);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}">
      <rect width="${pw}" height="${ph}" rx="${ph / 2}" fill="${DARK}"/>
      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-weight="700" font-size="${Math.round(ph * 0.58)}" letter-spacing="${Math.round(ph * 0.08)}" fill="#ffffff">ADMIN</text></svg>`;
    layers.push({ input: Buffer.from(svg), left: Math.round((size - pw) / 2), top: top + lmeta.height + Math.round(size * 0.03) });
  }
  let img = sharp({ create: { width: size, height: size, channels: 4, background: white ? DARK : "#ffffff" } }).composite(layers);
  if (flatten) img = img.flatten({ background: white ? DARK : "#ffffff" });
  await img.png().toFile(out(file));
  console.log("wrote", file);
}

(async () => {
  for (const kind of ["admin", "volunteer"]) {
    await make(192, kind, `${kind}-192.png`);
    await make(512, kind, `${kind}-512.png`);
    await make(180, kind, `${kind}-apple-180.png`, { flatten: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
