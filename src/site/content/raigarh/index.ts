import { organiser } from "../organiser";
import type { EventConfig } from "../types";
import { raigarhRules } from "./rules";

// TGCG Raigarh — a fully separate event. Never link to Raipur pages or reuse Raipur photos here.
// Fill in races, fees, venue, links.register, photos etc. as they are finalised.
// Every page already exists; empty sections show "announcing soon" instead of breaking.
const img = (p: string) => `/events/raigarh/${p}`; // put Raigarh photos in public/events/raigarh/

export const raigarh: EventConfig = {
  slug: "raigarh",
  basePath: "/raigarh",
  name: "Singhal The Great Chhattisgarh Run",
  shortName: "TGCG Raigarh",
  city: "Raigarh",
  cityHi: "रायगढ़",
  logo: { src: img("logo-tgcg-raigarh-black.png"), width: 3817, height: 1857 },
  edition: 2027,
  date: "2027-02-07T06:00:00+05:30", // first race start (21 KM, 6:00 AM)
  durationHours: 3.5, // until the last course closes (9:30 AM)
  dateLabel: "Sunday, 7 February 2027",
  dateLabelHi: "रविवार, 7 फ़रवरी 2027",
  // registrationDeadline: "",
  // registrationDeadlineHi: "",
  // registrationDeadlineDate: "2027-01-31T23:59:59+05:30",
  venue: {
    name: "Mini Stadium",
    nameHi: "मिनी स्टेडियम",
    detail: "Kelo Vihar, Raigarh, Chhattisgarh 496001",
    // Start location: https://maps.app.goo.gl/JXJQ9dcL9hk2hjQN8
    lat: 21.8886825,
    lng: 83.4041419,
    bbox: "83.397,21.884,83.411,21.893",
  },
  // Interactive course map (its own copy, never Raipur's). Tracks built by course-map-tools/build-raigarh.js
  courseMap: "/events/raigarh/course-map/index.html",
  rules: raigarhRules,
  links: {
    // register: "",
    // results: "https://<timing-partner>/results?bib={bib}",
  },
  contact: {
    whatsappNumber: organiser.whatsappNumber,
    whatsappUrl: organiser.whatsappUrl,
    email: organiser.email,
  },
  socials: [
    { name: "Instagram", handle: "@tgcg.raigarh", url: "https://www.instagram.com/tgcg.raigarh/" },
    { name: "Facebook", handle: "LetsRun", url: "https://www.facebook.com/letsrun.us/" },
    { name: "YouTube", handle: "@letsrunteam1317", url: "https://www.youtube.com/@letsrunteam1317" },
  ],
  instagram: {
    handle: "@tgcg.raigarh",
    url: "https://www.instagram.com/tgcg.raigarh/",
    posts: [], // paste Raigarh post / reel links here to embed them
    // Live feed of @tgcg.raigarh (its own feed, never Raipur's): paste the Behold.so JSON link here
    // (or set INSTAGRAM_TOKEN_RAIGARH in .env.local)
    // feedUrl: "https://feeds.behold.so/XXXXXXXX",
  },
  nav: [
    // Same order as Raipur / tgcg.run: Registration (header button) → Race Information → Training → Gallery → Contacts
    { href: "/race-info", label: "Race Info", labelHi: "जानकारी" },
    { href: "/course-map", label: "Course Map", labelHi: "रूट मैप" },
    { href: "/training", label: "Training", labelHi: "ट्रेनिंग" },
    { href: "/gallery", label: "Gallery", labelHi: "गैलरी" },
    { href: "/contact", label: "Contact", labelHi: "संपर्क" },
    { href: "/races", label: "Races & Fees", labelHi: "दौड़", more: true },
    { href: "/race-day", label: "Race Day", labelHi: "रेस डे", more: true },
    { href: "/rules", label: "Rules & FAQ", labelHi: "नियम", more: true },
    { href: "/pace-calculator", label: "Pace Calculator", labelHi: "पेस कैलकुलेटर", more: true },
    { href: "/results", label: "Results & Certificates", labelHi: "परिणाम", more: true },
  ],
  // 21 / 10 / 6 KM. Same timing pattern as the series, with 21 KM starting 6:00 AM and 10 KM 6:45 AM
  // (assembly, warm-up and course-close shifted with the start). Min. ages same as Raipur.
  // Routes: all out-and-back on the road in "raigarh 10.5.gpx" (see course-map-tools/build-raigarh.js).
  races: [
    {
      slug: "half-marathon",
      name: "Half Marathon",
      nameHi: "हाफ मैराथन",
      distance: "21.097 KM",
      km: 21.0975,
      minAge: 16,
      assemble: "5:30 AM",
      warmup: "5:40 AM",
      start: "6:00 AM",
      cutoff: "3:30 hrs",
      endBy: "9:30 AM",
      color: "#1f8fb3",
      courseMapId: "21k",
      gpx: "/events/raigarh/course-map/gpx/21KM Half Marathon.gpx",
      courseNote: "21.1 KM runners will take a U-turn at the 10.55 KM mark",
      courseNoteHi: "21.1 KM धावक 10.55 KM मार्क से U-टर्न लेंगे",
    },
    {
      slug: "10k",
      name: "Beginners Delight",
      nameHi: "बिगिनर्स डिलाइट",
      distance: "10 KM",
      km: 10,
      minAge: 14,
      assemble: "6:15 AM",
      warmup: "6:25 AM",
      start: "6:45 AM",
      cutoff: "2:00 hrs",
      endBy: "8:45 AM",
      color: "#2e9a4c",
      courseMapId: "10k",
      gpx: "/events/raigarh/course-map/gpx/10KM Beginners Delight.gpx",
      courseNote: "10 KM runners will take a U-turn at the 5 KM mark",
      courseNoteHi: "10 KM धावक 5 KM मार्क से U-टर्न लेंगे",
    },
    {
      slug: "6k",
      name: "Dream Run",
      nameHi: "ड्रीम रन",
      distance: "6 KM",
      km: 6,
      minAge: 12,
      assemble: "6:30 AM",
      warmup: "6:40 AM",
      start: "7:30 AM",
      cutoff: "1:30 hrs",
      endBy: "9:00 AM",
      color: "#ef8a1f",
      courseMapId: "6k",
      gpx: "/events/raigarh/course-map/gpx/6KM Dream Run.gpx",
      courseNote: "6 KM runners will take a U-turn at the 3 KM mark",
      courseNoteHi: "6 KM धावक 3 KM मार्क से U-टर्न लेंगे",
    },
  ],
  bibCollection: {
    venue: "Srijan Sabhakaksh (Srijan Kaksh), District Collectorate campus, Raigarh CG",
    // TODO: add links.bibVenueMap (Google Maps link) and the slot times when confirmed
    slots: [
      { day: "5 February 2027", time: "Time to be announced" },
      { day: "6 February 2027", time: "Time to be announced" },
    ],
  },
  raceDay: {
    parking: ["Inside Mini Stadium", "At the Collectorate", "Around the stadium"],
    notes: ["🚻 Toilets at Mini Stadium and the Collectorate. More bio-toilets will be provided. · मिनी स्टेडियम और कलेक्टरेट में शौचालय हैं, और बायो-टॉयलेट भी लगाए जाएँगे।"],
    tracksIntro: [
      { en: "All races run on the same road from Mini Stadium, out and back", hi: "सभी दौड़ मिनी स्टेडियम से एक ही रास्ते पर जाकर वापस आएँगी" },
    ],
    points: [
      {
        en: "Race timings are given above. Races begin on time, so please report at your race's timing.",
        hi: "दौड़ का समय ऊपर दिया गया है। दौड़ समय पर शुरू होगी, कृपया अपने समय पर पहुँचें।",
      },
      {
        en: "We are very punctual. All runs will strictly start at the given time, even with ONE PERSON on the start line and EVEN IF IT RAINS.",
        hi: "दौड़ एकदम समय पर चालू हो जाएगी, चाहे स्टार्ट लाइन पर एक ही व्यक्ति हो या बारिश हो रही हो।",
        strong: true,
      },
      { en: "There will be direction arrows wherever there is a turn.", hi: "हर मोड़ पर दिशा बताने वाले तीर लगे होंगे।" },
      { en: "All official participants are allotted unique numbers and BIBs.", hi: "सभी आधिकारिक प्रतिभागियों को अलग (यूनिक) नंबर और BIB दिए जाएँगे।" },
      {
        en: "You will get water bottles. PLEASE dispose of them properly in bins, and keep yours with you until you find one.",
        hi: "आपको पानी की बोतलें मिलेंगी। कृपया उन्हें डस्टबिन में ही डालें, जब तक डस्टबिन न मिले, बोतल अपने पास रखें।",
      },
      {
        en: "Bring everything you need and keep your belongings safe. The organisers are not responsible for any loss or theft.",
        hi: "ज़रूरत का सामान साथ लाएँ और अपना सामान सुरक्षित रखें। किसी भी नुकसान या चोरी के लिए आयोजक ज़िम्मेदार नहीं हैं।",
      },
    ],
  },
  // ₹500 + tax for every race. Competitive (prize money): 21 & 10 KM. Non-competitive: 21, 10 & 6 KM.
  fees: [
    {
      title: "Competitive",
      titleHi: "नकद पुरस्कार (इनाम) इच्छुक पंजीकरण",
      badge: "Cash prizes",
      price: 500,
      tax: "+ tax",
      taxHi: "₹500 + टैक्स",
      categories: ["21 KM Half Marathon", "10 KM Beginners Delight"],
      note: "Register in this category if you are running for prize money. Prize amounts to be announced.",
      featured: true,
    },
    {
      title: "Non-competitive",
      titleHi: "सामान्य पंजीकरण (बिना इनाम के)",
      badge: "No prizes",
      price: 500,
      tax: "+ tax",
      taxHi: "₹500 + टैक्स",
      categories: ["21 KM Half Marathon", "10 KM Beginners Delight", "6 KM Dream Run"],
      note: "Same race, timed, without prize money.",
    },
  ],
  // Competitive 21 & 10 KM. Age categories as in Raipur; amounts to be announced (add `ranks` like Raipur when ready).
  prizes: {
    columns: ["Open", "35 to 45 yrs", "46 & above"],
    races: [
      { name: "21 KM Half Marathon", color: "#1f8fb3" },
      { name: "10 KM", color: "#2e9a4c" },
    ],
  },
  stats: [],
  testimonials: [],
  sponsors: [],
  galleryImages: [],
  videos: { gallery: [] },
  images: {
    // hero: img("hero.jpg"),
    // card: img("card.jpg"),
  },
};

export const raigarhImg = img;
