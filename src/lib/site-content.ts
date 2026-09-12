// Confirmed 2026 event facts, sourced from reference/tgcg-run-content-audit.md.
// Prize amounts and hospitality rates are deliberately omitted/placeheld where
// the audit flagged them as unverified — do not invent numbers here.

export const EVENT = {
  name: "The Great Chhattisgarh Run",
  shortName: "LetsRun TGCG 2026",
  edition: "9th Edition",
  dateLabel: "Sunday, 20 December 2026",
  regDeadlineLabel: "10 December 2026",
  venueName: "Ekatma Path Park",
  venueAddress:
    "Ekatma Path (road towards Mantralaya), Sector 21, Atal Nagar–Nava Raipur, CG 492001",
  venueMapUrl: "https://maps.google.com/?q=21.1663205,81.77265215&z=15",
  tagline: "Run With The Flow",
  theme: "Rivers Run Through Us — Run for Cleaner Greener Rivers",
  certification:
    "First run in Central India certified by AIMS/IAAF, RFID chip-timed.",
};

export const BIB_COLLECTION = {
  venue: "Vrindavan Hall, Civil Lines, Raipur, CG",
  mapUrl: "https://maps.app.goo.gl/W2gAj4VL5e9mHaE78",
  windows: [
    { date: "18 December 2026", time: "11 AM – 5 PM" },
    { date: "19 December 2026", time: "10 AM – 3 PM" },
  ],
};

export const CONTACT = {
  email: "letsrunteam@gmail.com",
  whatsappDisplay: "+91 83053 87786 (830-LETSRUN)",
  whatsappHref: "https://wa.me/918305387786",
};

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/letsrun.us/",
  instagramLetsRun: "https://instagram.com/letsrun.us/",
  instagramTgcg: "https://instagram.com/tgcg.run/",
  youtube: "https://www.youtube.com/@letsrunteam1317",
};

export const LEGAL = {
  entityLine: "LetsRun Team, Raipur, CG 492001",
  formalName: "Runmatics OPC PVT LTD",
  cin: "U92490CT2016OPC007591",
};

export type Distance = {
  key: string;
  label: string;
  minAge: number;
  assemble: string;
  warmup: string;
  start: string;
  cutoff: string;
  endBy: string;
  routeUrl: string;
};

export const DISTANCES: Distance[] = [
  {
    key: "42k",
    label: "42.195 KM Marathon",
    minAge: 18,
    assemble: "3:30 AM",
    warmup: "3:40 AM",
    start: "4:00 AM",
    cutoff: "6:30 hrs",
    endBy: "10:30 AM",
    routeUrl: "https://www.plotaroute.com/route/2027134?units=km",
  },
  {
    key: "21k",
    label: "21.09 KM Half Marathon",
    minAge: 16,
    assemble: "5:00 AM",
    warmup: "5:10 AM",
    start: "5:30 AM",
    cutoff: "3:30 hrs",
    endBy: "9:00 AM",
    routeUrl: "https://www.plotaroute.com/route/2082962?units=km",
  },
  {
    key: "10k",
    label: "10 KM Beginners Delight",
    minAge: 14,
    assemble: "6:00 AM",
    warmup: "6:10 AM",
    start: "6:30 AM",
    cutoff: "2:00 hrs",
    endBy: "8:30 AM",
    routeUrl: "https://www.plotaroute.com/route/2080162?units=km",
  },
  {
    key: "6k",
    label: "6 KM Dream Run",
    minAge: 12,
    assemble: "6:30 AM",
    warmup: "6:40 AM",
    start: "7:30 AM",
    cutoff: "1:30 hrs",
    endBy: "9:00 AM",
    routeUrl: "https://www.plotaroute.com/route/2080164?units=km",
  },
];

export const WHATS_INCLUDED = [
  "Medal",
  "Chip-timed BIB",
  "DryFit event T-shirt",
  "Bag, napkin & BIB clips",
  "Other race-day goodies",
  "Internationally recognized online timing certificate",
  "Post-run hot breakfast",
  "Physio support",
  "Entertainment & games",
  "Water on course",
  "Professional event photos",
];

export const YOUTUBE = {
  teaser2026: { id: "CvWD1hgjuMk", title: "TGCG 2026 — Opening Teaser", isShort: true },
  anthem: {
    id: "miD3QQCGSN8",
    title: "HIRA TGCG.run Anthem — A Decade of Heart, Spirit & Run!",
  },
  trackTalk: {
    id: "2HkaVO2LAhM",
    title: "The TGCG Track — A Discussion with Amir",
  },
  recaps: [
    { id: "W-ekY87Mds8", title: "TGCG 2025 Recap" },
    { id: "6QFGF42GMA8", title: "TGCG 2024 Recap" },
    { id: "d7iIxBuqxXY", title: "TGCG 2023 Recap" },
    { id: "swm8nJZSOlo", title: "TGCG 2022 Film" },
    { id: "danL7Q5fsXY", title: "TGCG 2021 Recap" },
    { id: "O0OGxkx0yVg", title: "TGCG 2020 Recap" },
  ],
};

export const GALLERY_PHOTOS = [
  "https://p.taplink.st/p/e/7/6/6/63562344.jpg",
  "https://p.taplink.st/p/4/f/7/5/63562347.jpg",
  "https://p.taplink.st/p/a/6/4/0/63562350.jpg",
  "https://p.taplink.st/p/a/1/7/d/63562353.jpg",
  "https://p.taplink.st/p/2/b/9/8/63562366.jpg",
  "https://p.taplink.st/p/e/8/8/7/63562370.jpg",
  "https://p.taplink.st/p/f/b/5/b/63562372.jpg",
  "https://p.taplink.st/p/e/6/0/d/63562374.jpg",
  "https://p.taplink.st/p/0/e/0/5/63608018.jpg",
  "https://p.taplink.st/p/0/1/1/b/63608029.jpg",
  "https://p.taplink.st/p/6/6/e/5/63608049.jpg",
];

export const NAV_LINKS = [
  { href: "/race-information", label: "Race Information" },
  { href: "/gallery", label: "Gallery" },
  { href: "/rules", label: "Rules & Regulations" },
  { href: "/faq", label: "FAQ" },
];
