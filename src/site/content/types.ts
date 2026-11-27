// Shape every event config follows. Optional fields simply hide their section (or show "announcing soon") until filled in.

export type Race = {
  slug: string;
  name: string;
  nameHi?: string;
  distance: string;
  km?: number; // numeric distance for the pace calculator; parsed from `distance` when absent
  minAge?: number;
  assemble?: string;
  warmup?: string;
  start?: string;
  cutoff?: string; // e.g. "6:30 hrs"
  endBy?: string;
  track?: string;
  routeUrl?: string; // external route link, used only when the event has no interactive course map
  courseMapId?: string; // race id inside the interactive course map (e.g. "42k"); links to /course-map#42k
  courseNote?: string; // one-line course description for the race-day page, e.g. "2 × 21.1 km loop"
  courseNoteHi?: string;
  gpx?: string; // course GPX in /public; the pace calculator measures distance & U-turns from it
  color: string;
  motto?: string;
};

export type GalleryVideo = {
  id: string; // YouTube video id
  title: string;
  year?: number;
  note?: string; // short line under the title
};

export type Fee = {
  title: string;
  titleHi?: string;
  badge?: string;
  price: number;
  tax?: string; // shown after the price, e.g. "+ tax" (omit when the price already includes tax)
  taxHi?: string;
  categories: string[];
  note?: string;
  featured?: boolean;
};

// `more: true` puts the link under the "More" menu on desktop (it's always listed on mobile and in the footer).
export type NavItem = { href: string; label: string; labelHi?: string; more?: boolean };

export type Stat = {
  value: number;
  prefix?: string;
  suffix?: string;
  plain?: boolean; // true = show as-is (e.g. a year), no thousands separator
  label: string;
  labelHi?: string;
};

export type Testimonial = { quote: string; name: string; detail?: string; photo?: string };

export type Sponsor = { name: string; logo: string; url?: string; tier?: string };

export type PrizeTable = {
  columns: string[]; // age categories, e.g. ["Open", "35–45", "46+"]
  // ranks[rankIndex][columnIndex] in ₹. Leave ranks out while amounts are not announced yet.
  races: { name: string; color?: string; ranks?: number[][] }[];
  note?: string;
  noteHi?: string;
};

// Past editions on the Results page: podiums + link to the timing partner's results / certificates
export type Podium = { name: string; top: { name: string; bib?: string; time: string }[] };
export type PastEdition = {
  year: number;
  name: string; // event name exactly as on the timing partner's site
  provider: "sts" | "ifinish"; // Sports Timing Solutions or iFinish
  eventId: number | string;
  races: { label: string; competitive: boolean; source: string; main: Podium[]; groups: Podium[] }[];
};

// Rules & FAQ page
export type RulesSection = {
  id: string; // anchor, e.g. "prize-money" -> /rules#prize-money
  title: string;
  titleHi?: string;
  intro?: string;
  items: string[];
};
export type FaqItem = { q: string; a: string | string[]; link?: { href: string; label: string } }; // link href is relative to the event (e.g. "/races#fees")
export type FaqGroup = { title: string; titleHi?: string; items: FaqItem[] };
export type EventRules = { sections: RulesSection[]; faq: FaqGroup[] };

export type EventConfig = {
  slug: "raipur" | "raigarh";
  basePath: string;
  name: string;
  shortName: string; // e.g. "TGCG Raipur"
  city: string;
  cityHi?: string;
  edition: number;
  tagline?: string;
  cause?: string;
  date: string; // ISO with IST offset, used by the countdown and calendar file
  durationHours?: number; // calendar event length, default 6
  dateLabel: string;
  dateLabelHi?: string;
  registrationDeadline?: string;
  registrationDeadlineHi?: string;
  registrationDeadlineDate?: string; // ISO, drives the "closes in N days" chip
  logo?: { src: string; width: number; height: number };
  venue: {
    name: string;
    nameHi?: string;
    detail: string;
    lat?: number;
    lng?: number;
    bbox?: string; // OpenStreetMap embed bounding box "minLng,minLat,maxLng,maxLat"
  };
  links: {
    register?: string; // external registration form; page shows "opening soon" when absent
    raceInfoPdf?: string;
    hotelsMap?: string;
    bibVenueMap?: string;
    policies?: string; // terms, privacy, refund & payment policies page (linked from the footer)
    results?: string; // results / certificate URL; "{bib}" is replaced by the runner's BIB number
  };
  contact: {
    whatsappNumber: string;
    whatsappUrl: string; // ends with "&text=" so a message can be appended
    email: string;
  };
  socials: { name: string; handle: string; url: string }[];
  instagram?: {
    handle: string; // e.g. "@tgcg.run"
    url: string;
    posts?: string[]; // full post / reel URLs to embed, e.g. "https://www.instagram.com/p/XXXX/"
    feedUrl?: string; // live feed JSON link from behold.so (see src/lib/instagram.ts); or use an API token in .env.local
  };
  nav: NavItem[]; // hrefs relative to basePath
  races: Race[];
  fees: Fee[];
  prizes?: PrizeTable;
  bibCollection?: {
    venue: string;
    slots: { day: string; time: string }[];
    note?: string;
    noteHi?: string;
  };
  pastResults?: PastEdition[]; // newest first
  // Editions with no published results, shown as their own tab, e.g. { label: "2020–21", after: 2022, note: "..." }
  pastResultsGaps?: { label: string; after: number; note: string; noteHi?: string }[];
  // Rules & FAQ page (/rules). Omit to hide the page and its links.
  rules?: EventRules;
  // Interactive course map (a static mini-site in /public), shown on the event's /course-map page
  courseMap?: string; // e.g. "/events/raipur/course-map/index.html"
  raceDay?: {
    parking?: string[];
    parkingMap?: string; // Google Maps link to the parking area
    bagDrop?: string;
    notes?: string[];
    // "Pay attention to the following points" on the race-day page.
    // The start-location line is added automatically from venue; the course lines come from each race's courseNote.
    points?: { en: string; hi?: string; strong?: boolean }[];
    tracksIntro?: { en: string; hi?: string }[]; // e.g. "2 different tracks this year", shown above the per-race course lines
  };
  training?: {
    video?: string;
    intro?: string;
    points?: string[];
  };
  facilities?: { en: string; hi?: string }[];
  hotels?: { name: string; phone: string }[];
  highlight?: { eyebrow: string; title: string; points: string[]; href: string; cta: string };
  stats?: Stat[];
  testimonials?: Testimonial[];
  sponsors?: Sponsor[];
  // Gallery videos: newest first; the first one is shown large as the featured film.
  videos?: { hero?: string; gallery?: GalleryVideo[] };
  galleryImages?: string[];
  // Edition theme: shown as a carousel on the gallery page (#theme) and linked from Race Info
  theme?: {
    title: string;
    titleHi?: string;
    tagline?: string; // e.g. "Run. Belong. Preserve."
    intro: string;
    images: string[]; // theme slides, in reading order
  };
  images?: {
    hero?: string; // wide photo behind the home hero
    card?: string; // photo on the event chooser card
    facilities?: string;
    schedule?: string;
    ageEligibility?: string;
    medal?: string; // a photo of the finisher medal
    prizeMoney?: string; // the prize money poster
    sponsors?: string; // single sponsors poster, used when `sponsors` logos are not set
  };
};
