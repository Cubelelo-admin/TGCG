import { z } from "zod";

const phoneRegex = /^[6-9]\d{9}$/; // Indian mobile numbers
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const aadharRegex = /^\d{12}$/;

const attendeeObjectSchema = z.object({
    fullName: z.string().trim().min(2, "Full name is required").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    confirmEmail: z.string().trim().toLowerCase().email(),
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
    // superRefine below, since KYC fields are conditionally required.
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

const emailsMatch = (data: { email: string; confirmEmail: string }) =>
  data.email === data.confirmEmail;
const emailsMatchRefinement = {
  message: "Emails do not match",
  path: ["confirmEmail"],
};

/** Used by the client-side attendee-details form (step 2 of registration). */
export const attendeeFieldsSchema = attendeeObjectSchema.refine(
  emailsMatch,
  emailsMatchRefinement
);

/** Full payload the server validates, including catalog selection. */
export const registrationSchema = attendeeObjectSchema
  .extend({
    ticketCategoryId: z.string().uuid(),
    addonIds: z.array(z.string().uuid()).default([]),
  })
  .refine(emailsMatch, emailsMatchRefinement);

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type AttendeeFieldsInput = z.infer<typeof attendeeFieldsSchema>;

/** Additional server-side check for categories that require prize-money KYC. */
export function validateKycRequired(
  data: RegistrationInput,
  requiresKyc: boolean
): string | null {
  if (!requiresKyc) return null;
  if (!data.aadharNumber) return "Aadhar number is required for this category";
  if (!data.bankNameLocation) return "Bank name & location is required for this category";
  if (!data.bankAccountNumber) return "Bank account number is required for this category";
  if (!data.bankIfsc) return "Bank IFSC code is required for this category";
  return null;
}
