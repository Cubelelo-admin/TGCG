import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServiceClient>;

/**
 * Admin registration search. "all" matches the term against every field we
 * store for a registration; the others narrow it to one field. Shared by the
 * listing page and the CSV export so "Export CSV" always exports exactly
 * what the search shows.
 */
export const SEARCH_FIELDS = {
  all: "All fields",
  name: "Name",
  phone: "Phone",
  email: "Email",
  registration_code: "Registration ID",
  booking_code: "Group / Booking ID",
  bib: "BIB",
  category: "Category",
  poc: "POC",
  city: "City",
  community: "Organization / community",
  tshirt: "T-shirt size",
  dob: "Date of birth",
  kyc: "Aadhar / PAN / bank",
  payment: "Payment ref / UTR / note",
} as const;

export type SearchField = keyof typeof SEARCH_FIELDS;

export function parseSearchField(value: string | null | undefined): SearchField {
  return value && value in SEARCH_FIELDS ? (value as SearchField) : "all";
}

const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"];

// Plain text columns on registrations, per field. "all" = every one of them.
const TEXT_COLUMNS: Partial<Record<SearchField, string[]>> = {
  name: ["full_name"],
  email: ["email"],
  registration_code: ["registration_code"],
  bib: ["bib_number"],
  poc: ["poc_name"],
  city: ["city"],
  community: ["organization", "running_community"],
  tshirt: ["tshirt_size"],
  kyc: ["aadhar_number", "pan_number", "bank_name_location", "bank_account_number", "bank_ifsc"],
  payment: [
    "manual_payment_ref",
    "manual_payment_note",
    "manual_paid_by",
    "manual_payment_mode",
    "payment_method",
    "razorpay_order_id",
    "razorpay_payment_id",
  ],
};
const ALL_TEXT_COLUMNS = [...Object.values(TEXT_COLUMNS).flat(), "gender"];
// Digit-only columns: "98765 43210" / "+91-98765-43210" / "1234 5678 9012" should still match.
const DIGIT_COLUMNS = ["phone", "emergency_phone", "aadhar_number", "bank_account_number"];

/** Quote a value for a PostgREST logic tree so commas, dots, parens etc. can't break the filter. */
function quote(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
const ilike = (column: string, term: string) => `${column}.ilike.${quote(`%${term}%`)}`;

/** 2026-11-17, 17/11/2026, 17-11-2026, 17.11.2026 → "2026-11-17". */
function parseDate(term: string): string | null {
  let y: number, m: number, d: number;
  const iso = term.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const indian = term.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (indian) [d, m, y] = [Number(indian[1]), Number(indian[2]), Number(indian[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

function nextDay(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const MATCH_NOTHING = "id.eq.00000000-0000-0000-0000-000000000000";

/**
 * Builds the `.or(...)` filter for a search term, or null for an empty term.
 * Matches in related tables (category name, booking code, category-change
 * POC/ref/note) are resolved to ids first, since PostgREST can't OR across
 * an embedded resource.
 */
export async function buildRegistrationSearchFilter(
  supabase: Supabase,
  eventId: string,
  rawTerm: string | null | undefined,
  field: SearchField = "all"
): Promise<string | null> {
  const term = (rawTerm ?? "").trim().slice(0, 100);
  if (!term) return null;

  const all = field === "all";
  const parts: string[] = [];

  if (field === "tshirt") {
    // Exact (case-insensitive) — "XL" shouldn't also match XXL / XXXL.
    parts.push(`tshirt_size.ilike.${quote(term)}`);
  } else {
    for (const col of all ? ALL_TEXT_COLUMNS : (TEXT_COLUMNS[field] ?? [])) {
      parts.push(ilike(col, term));
    }
  }

  // Phone / Aadhar / account numbers, ignoring spaces, dashes and a +91 prefix.
  const looksNumeric = /^[+\d\s().-]+$/.test(term);
  const digits = term.replace(/\D/g, "");
  if (looksNumeric && digits.length >= 3) {
    const phoneDigits = digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits;
    if (all || field === "phone") {
      parts.push(ilike("phone", phoneDigits), ilike("emergency_phone", phoneDigits));
    }
    if (all || field === "kyc") {
      for (const col of DIGIT_COLUMNS.slice(2)) parts.push(ilike(col, digits));
    }
  } else if (field === "phone") {
    parts.push(ilike("phone", term), ilike("emergency_phone", term));
  }

  const date = parseDate(term);
  if (date && (all || field === "dob")) parts.push(`date_of_birth.eq.${date}`);
  if (date && all) {
    // Registered on that (IST) day.
    parts.push(
      `and(created_at.gte.${quote(`${date}T00:00:00+05:30`)},created_at.lt.${quote(`${nextDay(date)}T00:00:00+05:30`)})`
    );
  }

  if (all) {
    if (/^\d+(\.\d{1,2})?$/.test(term)) parts.push(`amount_inr.eq.${term}`);
    const status = term.toLowerCase();
    if (PAYMENT_STATUSES.includes(status)) parts.push(`payment_status.eq.${status}`);
  }

  const lookups: Promise<void>[] = [];

  if (all || field === "category") {
    lookups.push(
      (async () => {
        const { data } = await supabase
          .from("ticket_categories")
          .select("id")
          .eq("event_id", eventId)
          .ilike("name", `%${term}%`);
        const ids = (data ?? []).map((r) => r.id as string);
        if (ids.length) parts.push(`ticket_category_id.in.(${ids.join(",")})`);
      })()
    );
  }

  if (all || field === "booking_code") {
    lookups.push(
      (async () => {
        // "All fields" also matches the booking's organizer (who ran the checkout).
        const columns = all ? ["booking_code", "organizer_full_name", "organizer_email"] : ["booking_code"];
        const { data } = await supabase
          .from("registration_groups")
          .select("id")
          .eq("event_id", eventId)
          .or(columns.map((c) => ilike(c, term)).join(","))
          .limit(200);
        const ids = (data ?? []).map((r) => r.id as string);
        if (ids.length) parts.push(`group_id.in.(${ids.join(",")})`);
      })()
    );
  }

  // Category-change adjustments (0024): who collected the difference, its ref/note.
  if (all || field === "poc" || field === "payment") {
    lookups.push(
      (async () => {
        const columns =
          field === "poc"
            ? ["poc_name"]
            : field === "payment"
              ? ["reference", "note", "created_by"]
              : ["poc_name", "reference", "note", "created_by", "from_category_name", "to_category_name"];
        const { data, error } = await supabase
          .from("registration_adjustments")
          .select("registration_id")
          .eq("event_id", eventId)
          .or(columns.map((c) => ilike(c, term)).join(","))
          .limit(200);
        if (error) return; // table not created yet (migration 0024 pending) — just skip
        const ids = [...new Set((data ?? []).map((r) => r.registration_id as string))];
        if (ids.length) parts.push(`id.in.(${ids.join(",")})`);
      })()
    );
  }

  await Promise.all(lookups);
  return parts.length ? parts.join(",") : MATCH_NOTHING;
}
