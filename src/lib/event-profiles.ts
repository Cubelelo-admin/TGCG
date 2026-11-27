/**
 * Per-event display copy that isn't in the `events` table: what the ticket
 * page, confirmation emails and WhatsApp messages say about each event.
 * Keyed by events.slug. Safe to import from client components (no secrets —
 * only env var NAMES for the AiSensy campaigns, resolved server-side).
 */

export const DEFAULT_EVENT_SLUG = "tgcg-2026";

export type BibCollectionInfo = {
  schedule: { date: string; time: string }[];
  venue: string;
  mapsUrl: string | null;
};

export type EventProfile = {
  slug: string;
  /** Used in email subjects and the Razorpay checkout description, e.g. "TGCG 2026". */
  shortName: string;
  /** Used as the email sender name and in headings, e.g. "LetsRun TGCG 2026". */
  fullName: string;
  /** Short venue shown on the ticket header and in emails. */
  venueShort: string;
  /** One-line date/time for emails, e.g. "20 Dec 2026, 4:00 AM IST". */
  dateTimeLine: string;
  /** Split date for the ticket card's date badge. */
  ticketDate: { day: string; month: string; year: string; weekday: string };
  /** null hides the "View BIB Collection Details" button. */
  bibCollection: BibCollectionInfo | null;
  /**
   * The ticket page's "Race Booklet & FAQ" link (a stable /api/assets/<id> link whose PDF is uploaded under
   * Admin → Configuration → Race Assets), or null to hide the button.
   */
  raceBookletHref: string | null;
  /** Whether the ticket page shows the WhatsApp group picker (configured under Admin → Configuration, TGCG 2026 only for now). */
  showWaGroups: boolean;
  /**
   * Names of the env vars holding this event's approved AiSensy campaign
   * names. A template's static text names the event, so a new event needs
   * its own approved templates — an unset var just skips WhatsApp (email
   * still goes out).
   */
  aisensyRegistrationCampaignEnv: string;
  aisensyBookingSummaryCampaignEnv: string;
};

const PROFILES: Record<string, EventProfile> = {
  "tgcg-2026": {
    slug: "tgcg-2026",
    shortName: "TGCG 2026",
    fullName: "LetsRun TGCG 2026",
    venueShort: "CBD Square, Naya Raipur",
    dateTimeLine: "20 Dec 2026, 4:00 AM IST",
    ticketDate: { day: "20", month: "DEC", year: "2026", weekday: "SUNDAY" },
    bibCollection: {
      schedule: [
        { date: "18 Dec 2026", time: "11 AM – 5 PM" },
        { date: "19 Dec 2026", time: "10 AM – 3 PM" },
      ],
      venue: "Vrindavan Hall, Civil Lines, Raipur CG",
      mapsUrl: "https://maps.app.goo.gl/W2gAj4VL5e9mHaE78",
    },
    raceBookletHref: "/api/assets/race-information",
    showWaGroups: true,
    aisensyRegistrationCampaignEnv: "AISENSY_REGISTRATION_CAMPAIGN",
    aisensyBookingSummaryCampaignEnv: "AISENSY_BOOKING_SUMMARY_CAMPAIGN",
  },

  // Keep in sync with the events row (supabase/migrations/0034_raigarh_2027_details.sql) and the public
  // site's src/site/content/raigarh/index.ts.
  "raigarh-2027": {
    slug: "raigarh-2027",
    shortName: "TGCG Raigarh 2027",
    fullName: "LetsRun TGCG Raigarh 2027",
    venueShort: "Mini Stadium, Raigarh",
    dateTimeLine: "7 Feb 2027, 6:00 AM IST",
    ticketDate: { day: "07", month: "FEB", year: "2027", weekday: "SUNDAY" },
    bibCollection: null, // TODO: schedule + venue + maps link once the organiser confirms them
    raceBookletHref: "/api/assets/raigarh-race-information", // the race-info page until its PDF is uploaded
    showWaGroups: false,
    aisensyRegistrationCampaignEnv: "AISENSY_REGISTRATION_CAMPAIGN_RAIGARH",
    aisensyBookingSummaryCampaignEnv: "AISENSY_BOOKING_SUMMARY_CAMPAIGN_RAIGARH",
  },
};

/** Falls back to TGCG 2026's profile for an unknown slug (e.g. a row with no event join). */
export function getEventProfile(slug: string | null | undefined): EventProfile {
  return (slug && PROFILES[slug]) || PROFILES[DEFAULT_EVENT_SLUG];
}

export function isKnownEventSlug(slug: string): boolean {
  return slug in PROFILES;
}
