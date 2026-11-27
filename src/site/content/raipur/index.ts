import { organiser } from "../organiser";
import type { EventConfig } from "../types";
import { raipurPastResults } from "./past-results";
import { raipurRules } from "./rules";

// TGCG Raipur — update this file each edition.
const img = (p: string) => `/events/raipur/${p}`;

export const raipur: EventConfig = {
  slug: "raipur",
  basePath: "/raipur",
  name: "Hira The Great Chhattisgarh Run",
  shortName: "TGCG Raipur",
  city: "Naya Raipur",
  cityHi: "नया रायपुर",
  edition: 2026,
  tagline: "Run With The Flow",
  cause: "Run for Cleaner Rivers",
  date: "2026-12-20T04:00:00+05:30", // marathon start
  durationHours: 6.5,
  dateLabel: "Sunday, 20 December 2026",
  dateLabelHi: "रविवार, 20 दिसम्बर 2026",
  registrationDeadline: "10 December 2026",
  registrationDeadlineHi: "अंतिम पंजीकरण तिथि: 10 दिसम्बर 2026",
  registrationDeadlineDate: "2026-12-10T23:59:59+05:30",  logo: { src: img("logo-tgcg-black.png"), width: 987, height: 508 },
  venue: {
    name: "CBD Square",
    nameHi: "सीबीडी स्क्वायर",
    detail: "Naya Raipur, Chhattisgarh 492001",
    // Start & Finish point for all races, taken from the course GPX files (course-map/gpx)
    lat: 21.165654,
    lng: 81.774223,
    bbox: "81.766,21.159,81.783,21.172",
  },
  courseMap: "/events/raipur/course-map/index.html",
  rules: raipurRules,
  pastResults: raipurPastResults,
  pastResultsGaps: [
    {
      label: "2020–21",
      after: 2022,
      note: "Due to COVID, the 2020 and 2021 editions were non-timed runs on an invite-only basis, so there are no official results or timing certificates for these years.",
      noteHi: "कोविड के कारण 2020 और 2021 की दौड़ केवल आमंत्रण पर और बिना टाइमिंग के हुई थी, इसलिए इन वर्षों के परिणाम या टाइमिंग सर्टिफिकेट उपलब्ध नहीं हैं।",
    },
  ],
  links: {
    register: "https://tgcg.vercel.app/register",
    policies: "/policies",
    raceInfoPdf: "https://tgcg.vercel.app/api/assets/race-information",
    hotelsMap: "https://maps.app.goo.gl/DqvNrUkrCBEdKjzy9",
    bibVenueMap: "https://maps.app.goo.gl/W2gAj4VL5e9mHaE78",
    // results: "https://<timing-partner>/results?bib={bib}",  // add when the timing partner shares the link
  },
  contact: {
    whatsappNumber: organiser.whatsappNumber,
    whatsappUrl: organiser.whatsappUrl,
    email: organiser.email,
  },
  socials: [
    { name: "Instagram", handle: "@tgcg.run", url: "https://www.instagram.com/tgcg.run/" },
    { name: "Facebook", handle: "LetsRun", url: "https://www.facebook.com/letsrun.us/" },
    { name: "YouTube", handle: "@letsrunteam1317", url: "https://www.youtube.com/@letsrunteam1317" },
  ],
  instagram: {
    handle: "@tgcg.run",
    url: "https://www.instagram.com/tgcg.run/",
    // Paste post or reel links here to embed them on the home page, e.g.
    // "https://www.instagram.com/p/ABC123xyz/", "https://www.instagram.com/reel/DEF456uvw/"
    posts: [],
    // Live feed of @tgcg.run: paste the Behold.so JSON link here (or set INSTAGRAM_TOKEN_RAIPUR in .env.local)
    feedUrl: "https://feeds.behold.so/RllO5qQan1FzSiBbO2Hh",
  },
  nav: [
    // Order follows tgcg.run: Registration (header button) → Race Information → Comrades Qualifier → Training → Gallery → Contacts
    { href: "/race-info", label: "Race Info", labelHi: "जानकारी" },
    { href: "/course-map", label: "Course Map", labelHi: "रूट मैप" },
    { href: "/comrades-qualifier", label: "Comrades Qualifier" },
    { href: "/training", label: "Training", labelHi: "ट्रेनिंग" },
    { href: "/gallery", label: "Gallery", labelHi: "गैलरी" },
    { href: "/contact", label: "Contact", labelHi: "संपर्क" },
    { href: "/races", label: "Races & Fees", labelHi: "दौड़", more: true },
    { href: "/race-day", label: "Race Day", labelHi: "रेस डे", more: true },
    { href: "/rules", label: "Rules & FAQ", labelHi: "नियम", more: true },
    { href: "/pace-calculator", label: "Pace Calculator", labelHi: "पेस कैलकुलेटर", more: true },
    { href: "/results", label: "Results & Certificates", labelHi: "परिणाम", more: true },
  ],
  races: [
    {
      slug: "marathon",
      name: "Marathon",
      nameHi: "मैराथन",
      distance: "42.195 KM",
      km: 42.195,
      minAge: 18,
      assemble: "3:30 AM",
      warmup: "3:40 AM",
      start: "4:00 AM",
      cutoff: "6:30 hrs",
      endBy: "10:30 AM",
      track: "Track A",
      routeUrl: "https://www.plotaroute.com/route/2027134?units=km",
      courseMapId: "42k",
      gpx: "/events/raipur/course-map/gpx/42KM Marathon.gpx",
      courseNote: "42 KM runners will run the 21.1 KM loop twice (2 × 21.1 KM)",
      courseNoteHi: "42 KM धावक 21.1 KM का लूप दो बार दौड़ेंगे (2 × 21.1 KM)",
      color: "#d93a3a",
      motto: "Run the Extraordinary",
    },
    {
      slug: "half-marathon",
      name: "Half Marathon",
      nameHi: "हाफ मैराथन",
      distance: "21.097 KM",
      km: 21.0975,
      minAge: 16,
      assemble: "5:00 AM",
      warmup: "5:10 AM",
      start: "5:30 AM",
      cutoff: "3:30 hrs",
      endBy: "9:00 AM",
      track: "Track A",
      routeUrl: "https://www.plotaroute.com/route/2082962?units=km",
      courseMapId: "21k",
      gpx: "/events/raipur/course-map/gpx/21KM Half Marathon.gpx",
      courseNote: "21.1 KM runners will take a U-turn at the 10.54 KM mark",
      courseNoteHi: "21.1 KM धावक 10.54 KM मार्क से U-टर्न लेंगे",
      color: "#1f8fb3",
      motto: "Strong Steps, Brighter Tomorrows",
    },
    {
      slug: "10k",
      name: "Beginners Delight",
      nameHi: "बिगिनर्स डिलाइट",
      distance: "10 KM",
      km: 10,
      minAge: 14,
      assemble: "6:00 AM",
      warmup: "6:10 AM",
      start: "6:30 AM",
      cutoff: "2:00 hrs",
      endBy: "8:30 AM",
      track: "Track A",
      routeUrl: "https://www.plotaroute.com/route/2080162?units=km",
      courseMapId: "10k",
      gpx: "/events/raipur/course-map/gpx/10KM Beginers Delight.gpx",
      courseNote: "10 KM runners will take a U-turn at the 5 KM mark",
      courseNoteHi: "10 KM धावक 5 KM मार्क से U-टर्न लेंगे",
      color: "#2e9a4c",
      motto: "Start Today, Go Further",
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
      track: "Track B",
      routeUrl: "https://www.plotaroute.com/route/2080164?units=km",
      courseMapId: "6k",
      gpx: "/events/raipur/course-map/gpx/6KM Dream Run.gpx",
      courseNote: "6 KM runners will take a U-turn at the 3 KM mark",
      courseNoteHi: "6 KM धावक 3 KM मार्क से U-टर्न लेंगे",
      color: "#ef8a1f",
      motto: "Run, Feel Good",
    },
  ],
  fees: [
    {
      title: "Competitive",
      titleHi: "नकद पुरस्कार (इनाम) इच्छुक पंजीकरण राशि",
      badge: "Cash prizes",
      price: 1750,
      categories: ["42 KM Marathon", "21 KM Half Marathon", "10 KM Beginners Delight"],
      note: "Register in this category if you are running for prize money.",
      featured: true,
    },
    {
      title: "Non-competitive",
      titleHi: "सामान्य पंजीकरण राशि (बिना इनाम के)",
      badge: "No prizes",
      price: 1450,
      categories: ["42 KM Marathon", "21 KM Half Marathon", "10 KM Beginners Delight", "6 KM Dream Run"],
      note: "Same facilities, timed certificate and medal.",
    },
  ],
  // From the prize money poster (public/events/raipur/medal.jpg). Same amount for men and women in each category.
  prizes: {
    columns: ["Open", "35 to 45 yrs", "46 & above"],
    races: [
      {
        name: "42 KM Marathon",
        color: "#d93a3a",
        ranks: [
          [50000, 20000, 15000],
          [20000, 15000, 10000],
          [15000, 10000, 8000],
        ],
      },
      {
        name: "21 KM Half Marathon",
        color: "#1f8fb3",
        ranks: [
          [25000, 10000, 8000],
          [15000, 9000, 7000],
          [10000, 7000, 5000],
        ],
      },
      {
        name: "10 KM",
        color: "#2e9a4c",
        ranks: [
          [15000, 9000, 7000],
          [11000, 7000, 6000],
          [8000, 5000, 5000],
        ],
      },
    ],
    // "Same for men and women" is now shown as a banner above the tables (PrizeTable.tsx)
  },
  bibCollection: {
    venue: "Vrindavan Hall, Civil Lines, Raipur CG",
    slots: [
      { day: "18 December 2026", time: "11 AM – 5 PM" },
      { day: "19 December 2026", time: "10 AM – 3 PM" },
    ],
    note: "If you registered through your company / HR / corporate, collect your BIB from them — not from the venue above.",
    noteHi:
      "अगर आप का पंजीकरण आपकी कंपनी / HR / corporate के द्वारा हुआ है तो BIB वहीं पे मिलेगा, ऊपर दिए हुए स्थान मे नहीं। कृपया वहाँ संपर्क करें।",
  },
  raceDay: {
    // From the course map (course-map/data/config.js → places)
    parking: ["Car, bike & bus parking next to the Start / Finish at CBD Square"],
    parkingMap: "https://maps.app.goo.gl/Zj2QNejofLHAUkP16",
    // bagDrop: "Where the bag drop is",
    tracksIntro: [
      { en: "There are 2 different tracks this year", hi: "इस साल 2 अलग-अलग ट्रैक हैं" },
      {
        en: "42 / 21 / 10 KM, competitive and non-competitive, share a common track",
        hi: "42 / 21 / 10 KM (कॉम्पिटिटिव और नॉन-कॉम्पिटिटिव) का ट्रैक एक ही है",
      },
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
      {
        en: "There will be direction arrows wherever there is a turn.",
        hi: "हर मोड़ पर दिशा बताने वाले तीर लगे होंगे।",
      },
      {
        en: "All official participants have been allotted unique numbers and BIBs.",
        hi: "सभी आधिकारिक प्रतिभागियों को अलग (यूनिक) नंबर और BIB दिए गए हैं।",
      },
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
  training: {
    video: "1HuNJn3iaGU",
    intro: "Get race-ready with the LetsRun team before race day. It's free.",
  },
  facilities: [
    { en: "Finisher medal", hi: "मेडल" },
    { en: "Chest number with timing chip", hi: "चेस्ट नंबर (चिप वाला)" },
    { en: "Dry-fit sports T-shirt", hi: "ड्राईफिट टी-शर्ट" },
    { en: "Bag", hi: "बेग" },
    { en: "Bottle", hi: "बोतल" },
    { en: "Napkin", hi: "नेपकिन" },
    { en: "Bib clips", hi: "बिब क्लिप" },
    { en: "Globally recognised online timing certificate", hi: "विश्व मान्यता प्राप्त टाइमिंग सर्टिफिकेट" },
    { en: "Beautiful open running track", hi: "सुंदर खुला दौड़ ट्रैक" },
    { en: "Warm-up Zumba", hi: "वार्मअप ज़ुम्बा" },
    { en: "Hot breakfast after the run", hi: "रन के बाद गरम नाश्ता" },
    { en: "Physio, games & more goodies", hi: "फिजियो, गेम्स और अन्य सुविधा" },
  ],
  hotels: [
    { name: "Courtyard Marriott", phone: "7714330000" },
    { name: "Hyatt Raipur", phone: "8370009064" },
    { name: "Ariena", phone: "7714054056" },
    { name: "Tulip Arena", phone: "7223058886" },
    { name: "Clarks Inn", phone: "9109163562" },
    { name: "Magneto Guest Rooms", phone: "9691922226" },
  ],
  highlight: {
    eyebrow: "Built for your personal best",
    title: "India's fastest Comrades qualifier course",
    points: [
      "World Athletics measured course since 2019",
      "2 × 21.1 km laps on a flat, fast course with aid every 3 km or less",
      "Registered for Comrades 2027? Show proof and get your full fee refunded",
    ],
    href: "/comrades-qualifier",
    cta: "Comrades qualifier details",
  },
  // Numbers count up when scrolled into view. Add real totals here, e.g.
  // { value: 12000, suffix: "+", label: "finishers so far", labelHi: "फिनिशर" }
  stats: [
    { value: 4, label: "race categories", labelHi: "दौड़ श्रेणियाँ" },
    { value: 1450, prefix: "₹", label: "entry from", labelHi: "पंजीकरण शुल्क से" },
    { value: 50000, prefix: "₹", label: "top marathon prize", labelHi: "मैराथन का सर्वोच्च इनाम" },
    { value: 2019, plain: true, label: "World Athletics measured since", labelHi: "से प्रमाणित कोर्स" },
  ],
  // Runner quotes appear on the home page once added, e.g.
  // { quote: "My first half marathon…", name: "Priya S.", detail: "Half Marathon 2025", photo: img("testimonials/priya.jpg") }
  testimonials: [],
  // Individual sponsor logos (shown as a logo wall). Until added, the sponsors poster below is shown.
  // { name: "Hira", logo: img("sponsors/hira.png"), url: "https://...", tier: "Title partner" }
  sponsors: [],
  videos: {
    hero: "CvWD1hgjuMk",
    // Edition films, newest first (titles from the LetsRun YouTube channel)
    gallery: [
      { id: "W-ekY87Mds8", title: "TGCG.run 2025", year: 2025, note: "Official film of the latest edition" },
      { id: "6QFGF42GMA8", title: "TGCG.run 2024", year: 2024, note: "Edition film" },
      { id: "d7iIxBuqxXY", title: "TGCG.run 2023", year: 2023, note: "Edition film" },
      { id: "swm8nJZSOlo", title: "TGCG.run 2022", year: 2022, note: "Edition film" },
      { id: "danL7Q5fsXY", title: "TGCG 2021", year: 2021, note: "Edition film" },
      { id: "O0OGxkx0yVg", title: "TGCG 2020", year: 2020, note: "Edition film" },
      { id: "0OPDCosrqcs", title: "TGCG.run 2019", year: 2019, note: "First World Athletics measured course" },
      { id: "6mK1BdCpp3s", title: "LetsRun 2018", year: 2018, note: "Event film" },
      { id: "pLgFAWAAV6Y", title: "LetsRun 2017", year: 2017, note: "Where it all began · flagship event" },
    ],
  },
  // Photos 09–30 (01–08 are the 2026 theme slides, shown separately below)
  galleryImages: Array.from({ length: 22 }, (_, i) => img(`gallery/${String(i + 9).padStart(2, "0")}.jpg`)),
  theme: {
    title: "Rivers of Chhattisgarh",
    titleHi: "छत्तीसगढ़ की नदियाँ",
    tagline: "Run. Belong. Preserve.",
    intro:
      "The theme for HIRA – The Great Chhattisgarh Run 2026 celebrates the state's rich river heritage and the vital role rivers play in sustaining life, nature, culture and communities. Through it, we highlight Chhattisgarh's beautiful rivers, their ecological significance, the biodiversity and livelihoods they support, and the importance of conserving and rejuvenating these lifelines for future generations. Just as rivers connect landscapes and communities, running brings people together through a shared spirit of fitness, unity and belonging. TGCG combines the joy of running with a larger message of environmental awareness and responsibility.",
    images: Array.from({ length: 8 }, (_, i) => img(`gallery/${String(i + 1).padStart(2, "0")}.jpg`)),
  },
  images: {
    hero: img("gallery/23.jpg"),
    card: img("gallery/10.jpg"),
    facilities: img("facilities.webp"),
    schedule: img("race-schedule.png"),
    ageEligibility: img("age-eligibility.png"),
    // medal: img("medal-photo.jpg"),  // add a real photo of the finisher medal to show it on the home page
    prizeMoney: img("medal.jpg"), // (file is the prize money poster)
    sponsors: img("sponsors/sponsors-2026.png"),
  },
};

// Raipur-only pages
export const raipurExtras = {
  comradesVideo: "2HkaVO2LAhM",
  comradesMap: img("comrades-map.png"),
  comradesCert: img("comrades-cert.png"),
};
