import {
  aadharRegex,
  bankAccountRegex,
  CHILD_RUNNER_CATEGORY_NAME,
  GENDERS,
  ifscRegex,
  panRegex,
  phoneRegex,
  TSHIRT_SIZES,
} from "./registration-schema";

/**
 * One row of the bulk-upload spreadsheet, as raw strings straight off the
 * sheet (or as edited inline in the preview grid) — validation/coercion
 * happens in validateBulkRow, not here, so the preview UI can hold
 * in-progress/invalid values without fighting a stricter type.
 */
export type BulkRowFields = {
  fullName: string;
  category: string;
  amountInr: string;
  phone: string;
  email: string;
  gender: string;
  city: string;
  organization: string;
  runningCommunity: string;
  dateOfBirth: string;
  tshirtSize: string;
  emergencyPhone: string;
  aadharNumber: string;
  bankNameLocation: string;
  bankAccountNumber: string;
  bankIfsc: string;
  panNumber: string;
};

export const EMPTY_BULK_ROW: BulkRowFields = {
  fullName: "",
  category: "",
  amountInr: "",
  phone: "",
  email: "",
  gender: "",
  city: "",
  organization: "",
  runningCommunity: "",
  dateOfBirth: "",
  tshirtSize: "",
  emergencyPhone: "",
  aadharNumber: "",
  bankNameLocation: "",
  bankAccountNumber: "",
  bankIfsc: "",
  panNumber: "",
};

/** Column order/labels for both the downloadable template and the parsed-upload header mapping. */
export const BULK_TEMPLATE_COLUMNS: { key: keyof BulkRowFields; label: string }[] = [
  { key: "fullName", label: "Full Name" },
  { key: "category", label: "Category" },
  { key: "amountInr", label: "Amount Paid" },
  { key: "phone", label: "Phone (WhatsApp)" },
  { key: "email", label: "Email" },
  { key: "gender", label: "Gender" },
  { key: "city", label: "City" },
  { key: "organization", label: "Organization" },
  { key: "runningCommunity", label: "Running Community" },
  { key: "dateOfBirth", label: "Date Of Birth (YYYY-MM-DD)" },
  { key: "tshirtSize", label: "T-Shirt Size" },
  { key: "emergencyPhone", label: "Emergency Contact Number" },
  { key: "aadharNumber", label: "Aadhar Number" },
  { key: "bankNameLocation", label: "Bank Name & Location" },
  { key: "bankAccountNumber", label: "Bank Account Number" },
  { key: "bankIfsc", label: "Bank IFSC" },
  { key: "panNumber", label: "PAN Number" },
];

export type BulkCategoryInfo = { id: string; event_id: string; name: string; requires_kyc: boolean };

/**
 * The template header asks for YYYY-MM-DD, but Excel/admins commonly type
 * DD-MM-YYYY or DD/MM/YYYY instead (sometimes with a 2-digit year) — none of
 * which `Date.parse` reads reliably (it silently misreads day-first as
 * month-first, or just returns NaN). This parses all of the above
 * explicitly and returns a normalized YYYY-MM-DD string, or null if the
 * value isn't a real calendar date under any of them.
 *
 * Day-first is tried before month-first for any D-M-Y / D/M/Y value, since
 * this event's admins and paper forms are India-based (DD-MM-YYYY) — it
 * only falls back to month-first when day-first isn't a valid date (e.g.
 * "12-25-1995"), so an unambiguous MM-DD-YYYY entry still comes through.
 */
export function parseDateOfBirth(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) {
    const [, y, m, d] = iso.map(Number);
    return isValidCalendarDate(y, m, d) ? toIsoDate(y, m, d) : null;
  }

  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(value);
  if (dmy) {
    const g1 = Number(dmy[1]);
    const g2 = Number(dmy[2]);
    const year = expandYear(Number(dmy[3]));

    if (isValidCalendarDate(year, g2, g1)) return toIsoDate(year, g2, g1); // day-first: g1=day, g2=month
    if (isValidCalendarDate(year, g1, g2)) return toIsoDate(year, g1, g2); // month-first: g1=month, g2=day
  }

  return null;
}

/** Matches Excel's own convention for a bare 2-digit year. */
function expandYear(y: number): number {
  if (y >= 100) return y;
  return y <= 29 ? 2000 + y : 1900 + y;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function findBulkCategory(
  categories: BulkCategoryInfo[],
  name: string
): BulkCategoryInfo | undefined {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  return categories.find((c) => c.name.trim().toLowerCase() === normalized);
}

/**
 * Field-level errors for one row, keyed by BulkRowFields so the preview grid
 * can highlight exactly the offending cell rather than just a row-level
 * message. Run identically client-side (live, as the admin edits) and
 * server-side (authoritative, never trusting the browser's pass) — see
 * /api/admin/registrations/bulk-import.
 */
export function validateBulkRow(
  row: BulkRowFields,
  categories: BulkCategoryInfo[]
): Partial<Record<keyof BulkRowFields, string>> {
  const errors: Partial<Record<keyof BulkRowFields, string>> = {};

  if (!row.fullName.trim() || row.fullName.trim().length < 2) {
    errors.fullName = "Required (min 2 characters)";
  }

  const category = findBulkCategory(categories, row.category);
  if (!row.category.trim()) {
    errors.category = "Required";
  } else if (!category) {
    errors.category = "Doesn't match any active category name";
  }

  const amount = Number(row.amountInr);
  if (row.amountInr.trim() === "" || Number.isNaN(amount) || amount < 0) {
    errors.amountInr = "Required, must be 0 or more";
  }

  if (category?.name === CHILD_RUNNER_CATEGORY_NAME) {
    if (row.email.trim() && !isValidEmail(row.email)) {
      errors.email = "Enter a valid email address";
    }
    // Child Runner: no phone/gender/city/DOB/t-shirt/emergency contact —
    // matches the online flow's minimal childRunnerSchema.
    return errors;
  }

  if (!phoneRegex.test(row.phone.trim())) {
    errors.phone = "Enter a valid 10-digit mobile number";
  }
  if (row.email.trim() && !isValidEmail(row.email)) {
    errors.email = "Enter a valid email address";
  }
  if (!GENDERS.includes(row.gender.trim().toLowerCase() as (typeof GENDERS)[number])) {
    errors.gender = `Must be one of ${GENDERS.join("/")}`;
  }
  if (!row.city.trim() || row.city.trim().length < 2) {
    errors.city = "Required";
  }
  if (!parseDateOfBirth(row.dateOfBirth)) {
    errors.dateOfBirth = "Enter a valid date (YYYY-MM-DD, DD-MM-YYYY, or DD/MM/YYYY)";
  }
  if (!TSHIRT_SIZES.includes(row.tshirtSize.trim().toUpperCase() as (typeof TSHIRT_SIZES)[number])) {
    errors.tshirtSize = `Must be one of ${TSHIRT_SIZES.join("/")}`;
  }
  if (!phoneRegex.test(row.emergencyPhone.trim())) {
    errors.emergencyPhone = "Enter a valid 10-digit mobile number";
  }

  if (category?.requires_kyc) {
    if (!aadharRegex.test(row.aadharNumber.trim())) {
      errors.aadharNumber = "Required, 12-digit Aadhar number (this category needs KYC)";
    }
    if (!row.bankNameLocation.trim()) {
      errors.bankNameLocation = "Required for this category";
    }
    if (!bankAccountRegex.test(row.bankAccountNumber.trim())) {
      errors.bankAccountNumber = "Required, valid bank account number";
    }
    if (!ifscRegex.test(row.bankIfsc.trim().toUpperCase())) {
      errors.bankIfsc = "Required, valid IFSC code";
    }
    if (row.panNumber.trim() && !panRegex.test(row.panNumber.trim().toUpperCase())) {
      errors.panNumber = "Enter a valid PAN, or leave blank";
    }
  }

  return errors;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
