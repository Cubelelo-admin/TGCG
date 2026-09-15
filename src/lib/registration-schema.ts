import { z } from "zod";

export const phoneRegex = /^[6-9]\d{9}$/; // Indian mobile numbers
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const aadharRegex = /^\d{12}$/;

export const MAX_GROUP_SIZE = 10;

/** Organizer's contact email — no longer collected in the flow; kept optional for any legacy callers. */
export const organizerEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .optional();

/** One attendee's personal details — everyone in a group booking fills their own. */
const attendeePersonalSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  phone: z.string().regex(phoneRegex, "Enter a valid 10-digit mobile number"),
  gender: z.enum(["male", "female", "others"]),
  city: z.string().trim().min(2, "City is required").max(80),
  organization: z.string().trim().max(120).optional().or(z.literal("")),
  runningCommunity: z.string().trim().max(120).optional().or(z.literal("")),
  dateOfBirth: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Enter a valid date of birth",
  }),
  tshirtSize: z.enum(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]),
  emergencyPhone: z
    .string()
    .regex(phoneRegex, "Enter a valid 10-digit emergency contact number"),

  // Required only for competitive (requires_kyc) categories — enforced by
  // validateKycRequired below, since KYC fields are conditionally required.
  aadharNumber: z.string().regex(aadharRegex, "Enter a valid 12-digit Aadhar number").optional().or(z.literal("")),
  bankNameLocation: z.string().trim().max(160).optional().or(z.literal("")),
  bankAccountNumber: z.string().trim().regex(/^\d{6,20}$/, "Enter a valid bank account number").optional().or(z.literal("")),
  bankIfsc: z.string().trim().toUpperCase().regex(ifscRegex, "Enter a valid IFSC code").optional().or(z.literal("")),
  panNumber: z.string().trim().toUpperCase().regex(panRegex, "Enter a valid PAN number").optional().or(z.literal("")),

  acceptedWaiver: z.literal(true, {
    message: "You must accept the accident waiver & Swachh Bharat Abhiyan terms",
  }),
  acceptedRules: z.literal(true, {
    message: "You must accept the rules & regulations",
  }),
});

/** Used by the client-side per-attendee form (category is picked separately, via the ticket accordion). */
export const attendeeFieldsSchema = attendeePersonalSchema;
export type AttendeeFieldsInput = z.infer<typeof attendeeFieldsSchema>;

/** Full per-attendee shape the server validates, including catalog selection. */
const attendeeCoreSchema = attendeePersonalSchema.extend({
  ticketCategoryId: z.string().uuid(),
  addonIds: z.array(z.string().uuid()).default([]),
});
export type AttendeeCoreInput = z.infer<typeof attendeeCoreSchema>;

/**
 * Full payload the server validates: 1..10 attendees, each with their own
 * ticket selection and details. No organizer identity is collected.
 */
export const groupRegistrationSchema = z
  .object({
    organizerEmail: organizerEmailSchema,
    attendees: z
      .array(attendeeCoreSchema)
      .min(1, "Add at least one attendee")
      .max(MAX_GROUP_SIZE, `A maximum of ${MAX_GROUP_SIZE} attendees can be registered together`),
  })
  // The client already blocks this at save-time, but the server is the
  // source of truth — never trust the client not to have sent duplicates.
  .superRefine((data, ctx) => {
    const seen = new Map<string, number>();
    data.attendees.forEach((a, i) => {
      const firstIndex = seen.get(a.phone);
      if (firstIndex === undefined) {
        seen.set(a.phone, i);
        return;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each attendee in a booking must have a unique phone number",
        path: ["attendees", i, "phone"],
      });
    });
  });
export type GroupRegistrationInput = z.infer<typeof groupRegistrationSchema>;

/** Additional server-side check for categories that require prize-money KYC. */
export function validateKycRequired(
  data: Pick<AttendeeCoreInput, "aadharNumber" | "bankNameLocation" | "bankAccountNumber" | "bankIfsc">,
  requiresKyc: boolean
): string | null {
  if (!requiresKyc) return null;
  if (!data.aadharNumber) return "Aadhar number is required for this category";
  if (!data.bankNameLocation) return "Bank name & location is required for this category";
  if (!data.bankAccountNumber) return "Bank account number is required for this category";
  if (!data.bankIfsc) return "Bank IFSC code is required for this category";
  return null;
}
