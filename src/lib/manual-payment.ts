import { aadharRegex, bankAccountRegex, ifscRegex, phoneRegex } from "@/lib/registration-schema";

export const MANUAL_PAYMENT_MODES = ["upi", "cash", "bank_transfer", "other"] as const;
export type ManualPaymentMode = (typeof MANUAL_PAYMENT_MODES)[number];

export const MANUAL_PAYMENT_MODE_LABELS: Record<ManualPaymentMode, string> = {
  upi: "UPI",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  other: "Other",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  razorpay: "Razorpay",
  manual: "Manual override",
  bulk_import: "Bulk import",
};

/** Payment statuses an admin can override into 'paid' after collecting directly. */
export const OVERRIDABLE_STATUSES = ["pending", "failed"] as const;

export type CompletenessInput = {
  full_name: string | null;
  phone: string | null;
  gender: string | null;
  city: string | null;
  date_of_birth: string | null;
  tshirt_size: string | null;
  emergency_phone: string | null;
  aadhar_number: string | null;
  bank_name_location: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  accepted_waiver: boolean;
  accepted_rules: boolean;
};

/**
 * Everything the public /register flow would have required before letting
 * this attendee pay — the manual override enforces the same bar, so a
 * directly-paid registration is never less complete than a Razorpay one.
 * Child Runner only ever collects a name (see 0014_child_runner.sql).
 */
export function missingRegistrationFields(
  r: CompletenessInput,
  category: { requires_kyc: boolean; hidden_from_picker: boolean } | null
): string[] {
  const missing: string[] = [];
  if (!r.full_name || r.full_name.trim().length < 2) missing.push("Full name");
  if (category?.hidden_from_picker) return missing;

  if (!r.phone || !phoneRegex.test(r.phone)) missing.push("Phone");
  if (!r.gender) missing.push("Gender");
  if (!r.city?.trim()) missing.push("City");
  if (!r.date_of_birth) missing.push("Date of birth");
  if (!r.tshirt_size) missing.push("T-shirt size");
  if (!r.emergency_phone || !phoneRegex.test(r.emergency_phone)) missing.push("Emergency phone");

  if (category?.requires_kyc) {
    if (!r.aadhar_number || !aadharRegex.test(r.aadhar_number)) missing.push("Aadhar number");
    if (!r.bank_name_location?.trim()) missing.push("Bank name & location");
    if (!r.bank_account_number || !bankAccountRegex.test(r.bank_account_number)) missing.push("Bank account number");
    if (!r.bank_ifsc || !ifscRegex.test(r.bank_ifsc)) missing.push("Bank IFSC");
  }

  if (!r.accepted_waiver || !r.accepted_rules) missing.push("Waiver & rules consent");
  return missing;
}
