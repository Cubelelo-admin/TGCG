(function () {
  "use strict";
  const C = window.CONFIG, ROUTES = window.ROUTES || {};
  const $ = (id) => document.getElementById(id);
  const STEP = 20; // metres between resampled points

  // ---------- geometry ----------
  const R = 6371000, rad = Math.PI / 180;
  function hav(a, b) {
    const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function bearing(a, b) {
    const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
    const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
    return (Math.atan2(y, x) / rad + 360) % 360;
  }

  // Build a route model: raw points, cumulative distances, resampled points.
  function buildRoute(raw) {
    const cum = [0];
    let climb = 0, descent = 0;
    for (let i = 1; i < raw.length; i++) {
      cum.push(cum[i - 1] + hav(raw[i - 1], raw[i]));
      const d = raw[i][2] - raw[i - 1][2];
      if (d > 0) climb += d; else descent -= d;
    }
    const total = cum[cum.length - 1];
    const pointAt = (m) => {
      m = Math.max(0, Math.min(total, m));
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= m) lo = mid; else hi = mid; }
      const seg = cum[hi] - cum[lo] || 1, t = (m - cum[lo]) / seg, a = raw[lo], b = raw[hi];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, bearing(a, b)];
    };
    const samples = [];
    for (let m = 0; m < total; m += STEP) samples.push({ m, p: pointAt(m) });
    samples.push({ m: total, p: pointAt(total) });
    const eles = raw.map((p) => p[2]);
    // U-turns: direction reverses (~180°) away from the start/finish area
    const uturns = [];
    for (let i = 1; i < raw.length - 1; i++) {
      if (hav(raw[i - 1], raw[i]) < 1 || hav(raw[i], raw[i + 1]) < 1 || hav(raw[0], raw[i]) < 300) continue;
      let d = Math.abs(bearing(raw[i - 1], raw[i]) - bearing(raw[i], raw[i + 1])); if (d > 180) d = 360 - d;
      if (d > 170) uturns.push({ m: cum[i], lat: raw[i][0], lng: raw[i][1], ele: raw[i][2] });
    }
    return { raw, total, climb, descent, pointAt, samples, uturns, minEle: Math.min(...eles), maxEle: Math.max(...eles) };
  }

  // Every km mark along the route where a lat/lng location is passed (handles loops/repeat passes).
  function passesOf(route, ll) {
    const near = route.samples.map((s) => ({ m: s.m, d: hav(s.p, ll) })).filter((s) => s.d < 80);
    const groups = [];
    near.forEach((s) => {
      const g = groups[groups.length - 1];
      if (g && s.m - g.last <= 300) { g.last = s.m; if (s.d < g.best.d) g.best = s; }
      else groups.push({ last: s.m, best: s });
    });
    return groups.map((g) => g.best.m);
  }

  const races = C.races.filter((r) => ROUTES[r.gpx]).map((r) => ({ ...r, route: buildRoute(ROUTES[r.gpx]) }));
  const missing = C.races.filter((r) => !ROUTES[r.gpx]);
  if (missing.length) console.warn("GPX not found in data/routes.js (run build.ps1):", missing.map((r) => r.gpx));

  // Resolve stations per race -> [{station, m, latlng}]
  function stationsFor(race) {
    const out = [];
    (C.stations || []).forEach((s) => {
      if (s.races && !s.races.includes(race.id)) return;
      if (s.km && s.km[race.id] != null) {
        [].concat(s.km[race.id]).forEach((km) => { const p = race.route.pointAt(km * 1000); out.push({ s, m: km * 1000, ll: [p[0], p[1]] }); });
      } else if (s.lat != null && s.lng != null) {
        const passes = passesOf(race.route, [s.lat, s.lng]);
        if (passes.length) passes.forEach((m) => out.push({ s, m, ll: [s.lat, s.lng] }));
        else if (s.races) out.push({ s, m: null, ll: [s.lat, s.lng] }); // explicitly assigned but off-route
      }
    });
    return out.sort((a, b) => (a.m ?? 1e12) - (b.m ?? 1e12));
  }

  // ---------- header ----------
  document.title = `${C.event.name} · Course Guide`;
  $("eventName").textContent = C.event.name;
  if (C.event.logo) {
    const logo = $("logo");
    logo.src = C.event.logo; logo.alt = C.event.name; logo.hidden = false;
    $("eventName").classList.add("with-logo");
  }
  $("tagline").textContent = C.event.tagline;
  $("eventDate").textContent = [C.event.date, C.event.city].filter(Boolean).join(" · ");
  const venue = $("venue");
  venue.textContent = "Start & Finish · " + C.event.venue;
  if (C.event.venueLink) venue.href = C.event.venueLink;
  $("footerNote").textContent = C.event.footerNote || "";

  // ---------- theme & embed ----------
  // Always light (matches the website). The Day/Night switch was removed.
  const root = document.documentElement;
  root.setAttribute("data-theme", "light");
  const isDark = () => false;
  // Embedded in the website (/raipur/course-map): hide this page's own header; the site provides one.
  const EMBED = /[?&]embed=1\b/.test(location.search) || window.self !== window.top;
  if (EMBED) root.classList.add("embed");

  // ---------- map ----------
  // When embedded, the mouse wheel scrolls the page instead of zooming the map (use the +/− buttons or pinch).
  const map = L.map("map", { zoomControl: true, scrollWheelZoom: !EMBED });
  // Esri basemaps: free, no API key, work from file:// as well as when hosted.
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
  function setTiles() {
    if (window._tiles) window._tiles.forEach((t) => map.removeLayer(t));
    const opts = { maxZoom: 19, maxNativeZoom: 16 };
    window._tiles = isDark()
      ? [L.tileLayer(ESRI + "Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { ...opts, attribution: "Tiles &copy; Esri" }),
         L.tileLayer(ESRI + "Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", opts)]
      : [L.tileLayer(ESRI + "World_Street_Map/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors" })];
    window._tiles.forEach((t) => t.addTo(map));
  }
  setTiles();

  const layers = { route: L.layerGroup().addTo(map), stations: L.layerGroup().addTo(map), km: L.layerGroup().addTo(map) };
  const placesLayer = L.layerGroup().addTo(map);
  const PLACE_ICONS = {
    parking: { emoji: "🅿️", color: "#2459c6", label: "Parking" },
    toilet:  { emoji: "🚻", color: "#5c6b7a", label: "Toilets" },
    medical: { emoji: "➕", color: "#d62839", label: "Medical" },
    baggage: { emoji: "🎒", color: "#8a5a2b", label: "Baggage counter" },
    info:    { emoji: "ℹ️", color: "#444",    label: "Help desk" },
    food:    { emoji: "🍽️", color: "#e09f1f", label: "Food" },
  };
  const runner = L.marker([0, 0], { interactive: false, zIndexOffset: 1000, icon: L.divIcon({ className: "", html: '<div class="runner-icon"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) });

  const ICONS = {
    recharge: { emoji: "⚡", color: "#e09f1f", label: "Recharge station" },
    water:   { emoji: "💧", color: "#1f8fd6", label: "Hydration" },
    aid:     { emoji: "🍌", color: "#e09f1f", label: "Aid station" },
    medical: { emoji: "➕", color: "#d62839", label: "Medical" },
    toilet:  { emoji: "🚻", color: "#5c6b7a", label: "Toilets" },
  };
  const stIcon = (type) => {
    const t = ICONS[type] || ICONS.water;
    return L.divIcon({ className: "", html: `<div class="st-icon" style="background:${t.color}"><span>${t.emoji}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 34], popupAnchor: [0, -32] });
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtKm = (m) => (m / 1000).toFixed(1);
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const isLight = (hex) => { const [r, g, b] = rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b > 170; };
  const shade = (hex, f) => "#" + rgb(hex).map((v) => Math.round(v * f).toString(16).padStart(2, "0")).join("");

  (C.places || []).forEach((pl) => {
    const t = PLACE_ICONS[pl.type] || PLACE_ICONS.info;
    const dir = `https://www.google.com/maps/dir/?api=1&destination=${pl.lat},${pl.lng}`;
    L.marker([pl.lat, pl.lng], { zIndexOffset: 400, icon: L.divIcon({ className: "", html: `<div class="pl-icon" style="background:${t.color}">${t.emoji}</div>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] }) })
      .bindTooltip(pl.name)
      .bindPopup(`<h3>${esc(pl.name)}</h3>` + (pl.note ? `<div>${esc(pl.note)}</div>` : "") +
        `<div style="margin-top:4px"><a href="${esc(dir)}" target="_blank" rel="noopener">Directions ↗</a>` +
        (pl.link ? ` · <a href="${esc(pl.link)}" target="_blank" rel="noopener">Open in Google Maps</a>` : "") + `</div>`)
      .addTo(placesLayer);
  });
  $("tglPlaces").addEventListener("change", (e) => e.target.checked ? map.addLayer(placesLayer) : map.removeLayer(placesLayer));

  ["tglRoute", "tglStations", "tglKm"].forEach((id, i) => {
    const key = ["route", "stations", "km"][i];
    $(id).addEventListener("change", (e) => e.target.checked ? map.addLayer(layers[key]) : map.removeLayer(layers[key]));
  });

  function setFull(full) {
    $("mapCard").classList.toggle("full", full);
    $("expandBtn").textContent = full ? "Close" : "Expand map";
    document.body.style.overflow = full ? "hidden" : "";
    setTimeout(() => map.invalidateSize(), 50);
  }
  $("expandBtn").addEventListener("click", () => {
    const card = $("mapCard");
    if (!EMBED) return setFull(!card.classList.contains("full"));
    // Inside the website the iframe is only as big as the page section, so use real full screen;
    // where that isn't supported (iPhone), open the map on its own in a new tab instead.
    if (document.fullscreenElement) return document.exitFullscreen();
    if (card.requestFullscreen) card.requestFullscreen().catch(() => window.open(location.pathname + location.hash, "_blank"));
    else window.open(location.pathname + location.hash, "_blank");
  });
  document.addEventListener("fullscreenchange", () => setFull(!!document.fullscreenElement));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("mapCard").classList.contains("full")) $("expandBtn").click(); });

  let current = null, currentStations = [], stationMarkers = [], kmMarkers = [], uturnMarkers = [];

  // ---------- km points ----------
  const gmaps = (lat, lng) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
  function kmPoints(race) {
    const r = race.route, fac = (window.KM_FACILITIES || {})[race.id] || {}, out = [];
    for (let km = 1; km * 1000 < r.total - 300; km++) {
      const p = r.pointAt(km * 1000);
      out.push({ km, label: String(km), lat: p[0], lng: p[1], ele: p[2], facilities: fac[km] || [] });
    }
    r.uturns.forEach((u) => out.push({ km: u.m / 1000, label: `U-turn (${fmtKm(u.m)})`, uturn: true, lat: u.lat, lng: u.lng, ele: u.ele, facilities: fac.uturn || [] }));
    out.sort((a, b) => a.km - b.km);
    const f = r.raw[r.raw.length - 1];
    out.push({ km: r.total / 1000, label: (r.total / 1000).toFixed(r.total % 1000 ? 3 : 0).replace(/\.?0+$/, "") + " (Finish)", finish: true,
      lat: f[0], lng: f[1], ele: f[2], facilities: [...(C.startLine || []), ...(fac.finish || [])] });
    // Course stations: add their items to the km row they fall on (within 250 m; return passes on
    // out & back courses land e.g. at 39.2 km)
    const passes = stationsFor(race).filter((e) => e.m != null);
    out.forEach((k) => {
      if (k.finish) return;
      passes.filter((e) => Math.abs(e.m - k.km * 1000) <= 250).forEach((e) => {
        k.facilities = [...new Set([...k.facilities, ...(e.s.items || [])])];
        k.station = k.station || e.s.name;
      });
    });
    return out;
  }
  const facHtml = (list) => list.length
    ? `<div class="tags">${list.map((i) => `<span class="tag">${esc(i)}</span>`).join("")}</div>`
    : (C.stations && C.stations.length ? `<span class="tba">—</span>` : `<span class="tba">To be announced</span>`);
  const kmPopup = (race, k) => `<h3>${esc(race.label)} · Km ${esc(k.label)}</h3>` +
    `<div>Elevation ${Math.round(k.ele)} m</div><div style="margin-top:4px">Facilities: ${facHtml(k.facilities)}</div>` +
    `<div style="margin-top:6px"><a href="${gmaps(k.lat, k.lng)}" target="_blank" rel="noopener">Open in Google Maps ↗</a></div>`;

  function drawKmList(race) {
    const pts = kmPoints(race);
    $("kmList").innerHTML = `<table><thead><tr><th>Km</th><th>Facilities</th><th>Elev.</th><th>Location</th></tr></thead><tbody>` +
      pts.map((k, i) => `<tr class="clickable${k.uturn ? " ut-row" : ""}" data-i="${i}"><td><b>${k.uturn ? "↩ " : ""}${esc(k.label)}</b></td><td>${facHtml(k.facilities)}</td><td>${Math.round(k.ele)} m</td>` +
        `<td><a href="${gmaps(k.lat, k.lng)}" target="_blank" rel="noopener">${k.lat.toFixed(5)}, ${k.lng.toFixed(5)} ↗</a></td></tr>`).join("") +
      `</tbody></table>`;
    $("kmList").querySelectorAll("tr[data-i]").forEach((tr) => tr.addEventListener("click", (ev) => {
      if (ev.target.closest("a")) return; // let the Google Maps link open normally
      const k = pts[+tr.dataset.i];
      $("mapCard").scrollIntoView({ behavior: "smooth", block: "center" });
      map.setView([k.lat, k.lng], Math.max(map.getZoom(), 16), { animate: false }); // sync -> km markers re-rendered
      if (k.finish) return;
      if (k.uturn) { const u = uturnMarkers.find((u) => Math.abs(u.m / 1000 - k.km) < 0.01); if (u) u.mk.openPopup(); return; }
      const mk = kmMarkers[+tr.dataset.i];
      if (mk) { if (!map.hasLayer(layers.km)) { $("tglKm").checked = true; map.addLayer(layers.km); } mk.openPopup(); }
    }));
  }

  $("csvBtn").addEventListener("click", () => {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["Race", "Track", "Km", "Latitude", "Longitude", "Elevation (m)", "Facilities", "Google Maps"]];
    races.forEach((race) => kmPoints(race).forEach((k) =>
      rows.push([race.label + " " + race.name, race.track || "", k.label, k.lat.toFixed(6), k.lng.toFixed(6), Math.round(k.ele), k.facilities.join("; "), gmaps(k.lat, k.lng)])));
    const blob = new Blob(["﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "km-points-all-races.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  function kmInterval(total) { return total > 25000 ? 5 : total > 12000 ? 2 : 1; }

  function drawMap(race) {
    Object.values(layers).forEach((l) => l.clearLayers());
    const r = race.route, latlngs = r.raw.map((p) => [p[0], p[1]]);
    L.polyline(latlngs, { color: "#fff", weight: 9, opacity: 0.9 }).addTo(layers.route);
    const line = L.polyline(latlngs, { color: race.color, weight: 5, opacity: 1 }).addTo(layers.route);

    // direction arrows every ~1 km (offset half km from km markers)
    const arrowEvery = Math.max(1000, kmInterval(r.total) * 500);
    for (let m = arrowEvery / 2; m < r.total - 200; m += arrowEvery) {
      const p = r.pointAt(m);
      L.marker([p[0], p[1]], { interactive: false, icon: L.divIcon({ className: "", iconSize: [14, 14], iconAnchor: [7, 7],
        html: `<div class="arrow-icon" style="transform:rotate(${p[3]}deg)"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1 L12 12 L7 9 L2 12 Z" fill="#fff"/></svg></div>` }) }).addTo(layers.route);
    }

    drawMapExtras(race, r); // start/finish + stations
    runner.addTo(map);
    map.fitBounds(line.getBounds(), { padding: [30, 30] });
    renderKm();
    drawLegend(race);
  }

  // Km markers that would overlap on screen (out & back, repeat laps) are merged into one
  // marker; they split apart as you zoom in. Re-rendered on every zoom.
  function renderKm() {
    const race = current;
    if (!race) return;
    layers.km.clearLayers();
    kmMarkers = [];
    const groups = [];
    kmPoints(race).forEach((k, i) => {
      if (k.finish || k.uturn) return;
      const px = map.latLngToLayerPoint([k.lat, k.lng]);
      const g = groups.find((g) => g.px.distanceTo(px) < 28);
      if (g) g.items.push({ ...k, i }); else groups.push({ px, items: [{ ...k, i }] });
    });
    groups.map((g) => g.items).forEach((g) => {
      const label = g.map((k) => k.km).join(" · ");
      const html = g.length > 1
        ? `<div class="km-icon km-multi" style="--c:${race.color}">${label}</div>`
        : `<div class="km-icon" style="--c:${race.color}">${label}</div>`;
      const mk = L.marker([g[0].lat, g[0].lng], { icon: L.divIcon({ className: "km-wrap", html, iconSize: null, iconAnchor: [12, 12] }) })
        .bindTooltip(`Km ${g.map((k) => k.km).join(", ")}`)
        .bindPopup(g.map((k) => kmPopup(race, k)).join('<hr class="pop-sep">'))
        .addTo(layers.km);
      g.forEach((k) => { kmMarkers[k.i] = mk; });
    });
  }
  map.on("zoomend", renderKm);

  function drawMapExtras(race, r) {
    // start / finish
    // one common Start & Finish for every track
    const sfp = C.event.startFinish ? [C.event.startFinish.lat, C.event.startFinish.lng] : [r.raw[0][0], r.raw[0][1]];
    const sf = (txt) => L.divIcon({ className: "", html: `<div class="sf-icon">${txt}</div>`, iconSize: null, iconAnchor: [0, 26] });
    L.marker(sfp, { icon: sf("🏁 Start / Finish"), zIndexOffset: 500 })
      .bindPopup(`<h3>Start & Finish · all tracks</h3>${esc(C.event.venue)}` +
        (C.startLine && C.startLine.length ? `<div style="margin-top:4px">Facilities:</div><div class="tags">${C.startLine.map((i) => `<span class="tag">${esc(i)}</span>`).join("")}</div>` : "") +
        `<div style="margin-top:4px"><a href="${gmaps(sfp[0], sfp[1])}" target="_blank" rel="noopener">Open this point in Google Maps ↗</a></div>` +
        (C.event.venueLink ? `<div><a href="${esc(C.event.venueLink)}" target="_blank" rel="noopener">Venue location ↗</a></div>` : "")).addTo(layers.route);

    // U-turn(s) — repeat passes at the same spot (e.g. 42K laps) share one marker
    uturnMarkers = [];
    const ug = [];
    r.uturns.forEach((u) => { const g = ug.find((g) => hav([g[0].lat, g[0].lng], [u.lat, u.lng]) < 60); if (g) g.push(u); else ug.push([u]); });
    ug.forEach((g) => {
      const kms = g.map((u) => fmtKm(u.m)).join(" & ");
      const mk = L.marker([g[0].lat, g[0].lng], { zIndexOffset: 450, icon: L.divIcon({ className: "", iconSize: null, iconAnchor: [-6, 12],
          html: `<div class="ut-icon" style="--c:${race.color}">↩ U-turn</div>` }) })
        .bindTooltip(`U-turn · km ${kms}`)
        .bindPopup(`<h3>${esc(race.label)} · U-turn</h3><div>At km ${kms}${g.length > 1 ? ` (${g.length} passes)` : ""}</div>` +
          `<div>Turn around here and return on the same road.</div>` +
          `<div style="margin-top:6px"><a href="${gmaps(g[0].lat, g[0].lng)}" target="_blank" rel="noopener">Open in Google Maps ↗</a></div>`)
        .addTo(layers.route);
      L.circleMarker([g[0].lat, g[0].lng], { radius: 6, color: "#111", weight: 2, fillColor: race.color, fillOpacity: 1, interactive: false }).addTo(layers.route);
      g.forEach((u) => uturnMarkers.push({ m: u.m, mk }));
    });

    // stations
    currentStations = stationsFor(race);
    const byStation = new Map();
    currentStations.forEach((e) => { if (!byStation.has(e.s)) byStation.set(e.s, []); byStation.get(e.s).push(e); });
    stationMarkers = [];
    byStation.forEach((entries, st) => {
      const kms = entries.filter((e) => e.m != null).map((e) => fmtKm(e.m) + " km").join(" & ");
      const html = `<h3>${esc(st.name)}</h3><div>${esc((ICONS[st.type] || ICONS.water).label)}${kms ? " · " + kms : ""}</div>` +
        (st.cutoff ? `<div>Cut-off: <b>${esc(st.cutoff)}</b></div>` : "") +
        (st.note ? `<div>${esc(st.note)}</div>` : "") +
        (st.items && st.items.length ? `<div class="tags">${st.items.map((i) => `<span class="tag">${esc(i)}</span>`).join("")}</div>` : "");
      entries.forEach((e) => {
        const mk = L.marker(e.ll, { icon: stIcon(st.type) }).bindPopup(html).addTo(layers.stations);
        stationMarkers.push({ e, mk });
      });
    });
  }

  function drawLegend(race) {
    const types = [...new Set(currentStations.map((e) => e.s.type || "water"))];
    $("legend").innerHTML =
      `<span><i style="background:${race.color}"></i>${esc(race.label)} route${race.track ? " · " + esc(race.track) : ""}</span>` +
      `<span>➤ Direction of running</span>` +
      `<span><b style="background:#fff;color:#222;border:2px solid ${race.color}">1</b>Km marker (tap for facilities)</span>` +
      types.map((t) => `<span>${(ICONS[t] || ICONS.water).emoji} ${(ICONS[t] || ICONS.water).label}</span>`).join("") +
      [...new Set((C.places || []).map((p) => p.type))].map((t) => { const i = PLACE_ICONS[t] || PLACE_ICONS.info; return `<span>${i.emoji} ${i.label}</span>`; }).join("");
  }

  // ---------- stats ----------
  function drawStats(race) {
    const r = race.route;
    const cards = [
      ["Distance", race.distance || (r.total / 1000).toFixed(1) + " km"],
      ["Start", race.start],
      ["Cut-off", race.cutoff],
      ["Ends by", race.endBy],
      ["Climb", "+" + Math.round(r.climb) + " m"],
    ].filter(([, v]) => v);
    const sched = [["Assemble", race.assemble], ["Zumba warm-up", race.warmup], ["Flag-off", race.start], ["Course closes", race.endBy]].filter(([, v]) => v);
    const catNote = { "Competitive": "Prize money", "Non-competitive": "No prize money" };
    const badges = (race.track ? `<span class="badge track">${esc(race.track)}</span>` : "") +
      (race.categories || []).map((c) => `<span class="badge ${/^non/i.test(c) ? "nc" : "comp"}">${/^non/i.test(c) ? "" : "🏆 "}${esc(c)}<small>${esc(catNote[c] || "")}</small></span>`).join("");
    $("stats").innerHTML = (badges ? `<div class="badges">${badges}</div>` : "") + cards.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join("") +
      (sched.length ? `<div class="schedule">${sched.map(([k, v]) => `<span><em>${esc(v)}</em>${k}</span>`).join("")}</div>` : "");
  }

  // ---------- elevation ----------
  let elevGeom = null;
  function drawElevation() {
    const race = current, r = race.route, box = $("elev");
    const W = box.clientWidth || 600, H = box.clientHeight || 200;
    const pad = { l: 40, r: 10, t: 10, b: 26 };
    const span = Math.max(30, r.maxEle - r.minEle);
    const mid = (r.maxEle + r.minEle) / 2;
    let y0 = Math.floor((mid - span * 0.6) / 5) * 5, y1 = Math.ceil((mid + span * 0.6) / 5) * 5;
    const x = (m) => pad.l + (m / r.total) * (W - pad.l - pad.r);
    const y = (e) => pad.t + (1 - (e - y0) / (y1 - y0)) * (H - pad.t - pad.b);
    const pts = r.samples.map((s) => `${x(s.m).toFixed(1)},${y(s.p[2]).toFixed(1)}`);
    const area = `M${x(0)},${y(y0)} L${pts.join(" L")} L${x(r.total)},${y(y0)} Z`;

    const yStep = (y1 - y0) <= 40 ? 10 : (y1 - y0) <= 100 ? 20 : 50;
    let grid = "";
    for (let e = Math.ceil(y0 / yStep) * yStep; e <= y1; e += yStep)
      grid += `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(e)}" y2="${y(e)}"/><text x="${pad.l - 6}" y="${y(e) + 4}" text-anchor="end">${e}</text>`;
    const xStep = kmInterval(r.total) * 1000;
    for (let m = 0; m <= r.total + 1; m += xStep) grid += `<text x="${x(m)}" y="${H - 8}" text-anchor="middle">${m / 1000}</text>`;

    const stMarks = currentStations.filter((e) => e.m != null).map((e) =>
      `<text x="${x(e.m)}" y="${pad.t + 12}" text-anchor="middle" font-size="12">${(ICONS[e.s.type] || ICONS.water).emoji}</text>` +
      `<line x1="${x(e.m)}" x2="${x(e.m)}" y1="${pad.t + 16}" y2="${y(y0)}" stroke="${(ICONS[e.s.type] || ICONS.water).color}" stroke-dasharray="2 3"/>`).join("");

    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs><linearGradient id="eg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${race.color}" stop-opacity=".45"/><stop offset="1" stop-color="${race.color}" stop-opacity=".05"/></linearGradient></defs>
      <g class="axis">${grid}</g>
      <path d="${area}" fill="url(#eg)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="${race.color}" stroke-width="2"/>
      ${stMarks}
      <line id="cur" y1="${pad.t}" y2="${y(y0)}" stroke="currentColor" stroke-opacity=".5"/>
      <circle id="curDot" r="5" fill="${race.color}" stroke="#fff" stroke-width="2"/>
      <rect id="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent" style="cursor:crosshair"/>
    </svg>`;
    box.style.color = "var(--muted)";
    elevGeom = { x, y, pad, W };
    const hit = box.querySelector("#hit");
    const toM = (ev) => {
      const rect = box.getBoundingClientRect();
      const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left) * (W / rect.width);
      return Math.max(0, Math.min(r.total, ((px - pad.l) / (W - pad.l - pad.r)) * r.total));
    };
    const move = (ev) => { const m = toM(ev); $("slider").value = Math.round((m / r.total) * 1000); setPosition(m); };
    hit.addEventListener("mousemove", move);
    hit.addEventListener("touchmove", (ev) => { ev.preventDefault(); move(ev); }, { passive: false });
    hit.addEventListener("click", (ev) => { const m = toM(ev); const p = r.pointAt(m); map.panTo([p[0], p[1]]); });

    $("elevSummary").textContent = `${race.label} ${race.name}: ${(r.total / 1000).toFixed(1)} km · +${Math.round(r.climb)} m total climb · elevation range ${Math.round(r.minEle)}–${Math.round(r.maxEle)} m`;
    $("sliderEnd").textContent = (r.total / 1000).toFixed(1) + " km";
    setPosition((+$("slider").value / 1000) * r.total);
  }

  function setPosition(m) {
    const r = current.route, p = r.pointAt(m);
    runner.setLatLng([p[0], p[1]]);
    if (elevGeom) {
      const cx = elevGeom.x(m), cy = elevGeom.y(p[2]);
      const cur = document.getElementById("cur"), dot = document.getElementById("curDot");
      if (cur) { cur.setAttribute("x1", cx); cur.setAttribute("x2", cx); }
      if (dot) { dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); }
    }
    let html = `<strong>${fmtKm(m)} km</strong> · ${Math.round(p[2])} m`;
    const ahead = currentStations.filter((e) => e.m != null && e.m >= m - 50)[0];
    if (ahead) html += ` · Next station: <strong>${esc(ahead.s.name)}</strong> in ${fmtKm(Math.max(0, ahead.m - m))} km`;
    $("readout").innerHTML = html;
  }

  $("slider").addEventListener("input", (e) => {
    const m = (+e.target.value / 1000) * current.route.total;
    setPosition(m);
    const p = current.route.pointAt(m);
    if (!map.getBounds().pad(-0.1).contains([p[0], p[1]])) map.panTo([p[0], p[1]]);
  });

  // ---------- station list ----------
  function drawStationList() {
    if (!currentStations.length) {
      $("stationList").innerHTML = `<p class="empty">Water station details coming soon.</p>`;
      return;
    }
    $("stationList").innerHTML = `<table><thead><tr><th>Km</th><th>Station</th><th>Available</th><th>Cut-off</th></tr></thead><tbody>` +
      currentStations.map((e, i) => `<tr class="clickable" data-i="${i}"><td>${e.m != null ? fmtKm(e.m) : "–"}</td><td>${(ICONS[e.s.type] || ICONS.water).emoji} ${esc(e.s.name)}</td><td>${esc((e.s.items || []).join(", "))}</td><td>${esc(e.s.cutoff || "")}</td></tr>`).join("") +
      `</tbody></table>`;
    $("stationList").querySelectorAll("tr[data-i]").forEach((tr) => tr.addEventListener("click", () => {
      const sm = stationMarkers[+tr.dataset.i];
      if (!sm) return;
      $("mapCard").scrollIntoView({ behavior: "smooth", block: "center" });
      map.setView(sm.e.ll, Math.max(map.getZoom(), 15));
      sm.mk.openPopup();
    }));
  }

  // ---------- race selection ----------
  function selectRace(id) {
    current = races.find((r) => r.id === id) || races[0];
    document.querySelectorAll(".pill").forEach((p) => p.classList.toggle("on", p.dataset.id === current.id));
    root.style.setProperty("--accent", current.color);
    // light colours (yellow) need dark text on top, and a darker shade when used as text
    root.style.setProperty("--accent-text", isLight(current.color) ? shade(current.color, 0.55) : current.color);
    $("slider").value = 0;
    drawStats(current);
    drawMap(current);
    drawElevation();
    drawStationList();
    drawKmList(current);
    history.replaceState(null, "", "#" + current.id);
    if (EMBED) postToSite({ type: "course-map-race", id: current.id });
  }

  // Tell the website page our height (so it shows the whole map page without a second scrollbar)
  // and which race is selected (so its address can be shared, e.g. /raipur/course-map#21k).
  function postToSite(msg) {
    if (window.parent !== window) window.parent.postMessage(msg, location.origin);
  }
  if (EMBED && window.ResizeObserver) {
    const sendHeight = () => postToSite({ type: "course-map-height", height: Math.ceil(document.body.getBoundingClientRect().height) });
    new ResizeObserver(sendHeight).observe(document.body);
    sendHeight();
  }

  $("racePills").innerHTML = races.map((r) =>
    `<button class="pill" data-id="${r.id}" style="--c:${r.color};--ink:${isLight(r.color) ? "#1b1d21" : "#fff"}"><span class="dot" style="background:${r.color}"></span>${esc(r.label)} <small>${esc(r.name)}${r.track ? " · " + esc(r.track) : ""}</small></button>`).join("");
  document.querySelectorAll(".pill").forEach((p) => p.addEventListener("click", () => selectRace(p.dataset.id)));
  // e.g. the website switching the race via #21k
  window.addEventListener("hashchange", () => { const id = location.hash.slice(1); if (id && (!current || id !== current.id)) selectRace(id); });

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => current && drawElevation(), 150); });

  if (!races.length) { $("stats").innerHTML = '<p class="empty">No routes found. Run build.ps1 to convert GPX files.</p>'; return; }
  selectRace(location.hash.slice(1) || races[0].id);
})();
