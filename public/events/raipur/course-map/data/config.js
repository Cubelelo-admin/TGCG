// =====================================================================
//  EDIT THIS FILE to update event details, race categories & stations.
//  Values marked TODO are placeholders waiting for real info.
// =====================================================================
window.CONFIG = {
  event: {
    name: "Hira The Great Chhattisgarh Run",
    logo: "assets/logo-black.png",      // logo for day mode
    logoDark: "",                       // optional white logo for night mode (else black logo on a light plate)
    tagline: "Course guide",
    date: "SUN 20 DEC 2026",
    city: "Nava Raipur",
    venue: "CBD Square, Nava Raipur",   // provisional — exact spot to be confirmed
    venueLink: "https://maps.app.goo.gl/fLr5WbfjqKnmfwtt7",
    // Common Start & Finish point for ALL tracks (where the flag is drawn)
    startFinish: { lat: 21.165654, lng: 81.774223 },
    footerNote: "Follow marshals and course signage on race day.",
  },

  // One entry per race. `gpx` must match a file name in /gpx.
  //   distance: official distance shown on the stat card (GPX-measured length is shown under the elevation chart)
  //   cutoff: time limit; endBy: clock time the course closes
  //   track: course name used on race day; categories: "Competitive" (prize money) / "Non-competitive"
  races: [
    { id: "42k", label: "42K", name: "Marathon",          gpx: "42KM Marathon.gpx",         distance: "42.195 km", color: "#f5c400",
      track: "Track A", categories: ["Competitive", "Non-competitive"],
      assemble: "3:30 AM", warmup: "3:40 AM", start: "4:00 AM", cutoff: "6:30 hrs", endBy: "10:30 AM" },
    { id: "21k", label: "21K", name: "Half Marathon",     gpx: "21KM Half Marathon.gpx",    distance: "21.09 km",  color: "#1f6fd1",
      track: "Track A", categories: ["Competitive", "Non-competitive"],
      assemble: "5:00 AM", warmup: "5:10 AM", start: "5:30 AM", cutoff: "3:30 hrs", endBy: "9:00 AM" },
    { id: "10k", label: "10K", name: "Beginners Delight", gpx: "10KM Beginers Delight.gpx", distance: "10 km",     color: "#22a447",
      track: "Track A", categories: ["Competitive", "Non-competitive"],
      assemble: "6:00 AM", warmup: "6:10 AM", start: "6:30 AM", cutoff: "2:00 hrs", endBy: "8:30 AM" },
    { id: "6k",  label: "6K",  name: "Dream Run",         gpx: "6KM Dream Run.gpx",         distance: "6 km",      color: "#e03131",
      track: "Track B", categories: ["Non-competitive"],
      assemble: "6:30 AM", warmup: "6:40 AM", start: "7:30 AM", cutoff: "1:30 hrs", endBy: "9:00 AM" },
  ],

  // Venue facilities shown on every race (not on the route).
  //   type: "parking" | "toilet" | "medical" | "baggage" | "info" | "food"
  places: [
    { name: "Parking — Car, Bike & Bus", type: "parking", lat: 21.167222, lng: 81.773312,
      link: "https://maps.app.goo.gl/Zj2QNejofLHAUkP16" },
  ],

  // Water / aid stations. Give EITHER lat+lng, OR km per race.
  //   type: "water" | "aid" | "medical" | "toilet"
  //   races: which race ids pass it (omit = all races)
  // Examples:
  //   { name: "WS1 · Main Gate", type: "water", lat: 21.1621, lng: 81.7852, items: ["Water", "Electrolyte"] },
  //   { name: "WS2", type: "aid", km: { "42k": [7.5, 30], "21k": [7.5] }, items: ["Water", "Bananas"], cutoff: "08:30" },
  //   Positions are the km points on the GPX (Track A = 21K file, Track B = 6K file). A station is shown on
  //   every pass of a race (out & back, 42K second lap) and its items appear in that km's row in the km table.
  stations: [
    { name: "1 KM Mark", type: "recharge", lat: 21.162674, lng: 81.783322,
      items: ["Recharge Station", "Hydration", "Toilet", "Music"] },
    // Track A (42K / 21K / 10K)
    { name: "3 KM Mark · Track A", type: "recharge", lat: 21.175997, lng: 81.791806, races: ["42k", "21k", "10k"],
      items: ["Recharge Station"] },
    { name: "5 KM Mark · Track A", type: "recharge", lat: 21.192991, lng: 81.798125, races: ["42k", "21k", "10k"],
      items: ["Recharge Station", "Hydration", "Medical aid", "Toilet"] },
    { name: "8 KM Mark · Track A", type: "water", lat: 21.209278, lng: 81.813655, races: ["42k", "21k", "10k"],
      items: ["Hydration"] },
    { name: "10.5 KM Mark · Track A", type: "recharge", lat: 21.192885, lng: 81.816025, races: ["42k", "21k", "10k"],
      items: ["Recharge Station", "Hydration", "Medical aid", "Toilet"] },
    // Track B (6K)
    { name: "2 KM Mark · Track B", type: "water", lat: 21.159453, lng: 81.792061, races: ["6k"],
      items: ["Hydration"] },
    { name: "3 KM Mark · Track B", type: "water", lat: 21.161400, lng: 81.799595, races: ["6k"],
      items: ["Hydration", "Toilet", "Medical aid"] },
  ],

  // Facilities at the common Start / Finish line (shown in its popup and on the Finish row)
  startLine: ["Hydration", "Medical aid", "Fire station", "Physiotherapy aid", "Doctor support", "Toilet", "Music"],
};
