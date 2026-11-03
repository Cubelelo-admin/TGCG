import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";
import {
  aadharRegex,
  bankAccountRegex,
  GENDERS,
  ifscRegex,
  panRegex,
  phoneRegex,
  TSHIRT_SIZES,
} from "@/lib/registration-schema";

export const runtime = "nodejs";

// email is optional for everyone now (the organizer-email step was removed
// from registration entirely — see RegisterFlow.tsx), not just Child Runner.
const baseUpdateSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").optional().or(z.literal("")),
  bibNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || v === "SUPERHERO" || /^\d{5}$/.test(v),
      "BIB number must be 5 digits (or SUPERHERO for a child runner)"
    ),
  checkedIn: z.boolean(),
  ticketCategoryId: z.string().uuid().optional(),
  // Group POC (0021) — empty string clears it.
  pocName: z.string().trim().max(120).optional().or(z.literal("")),
});

// Empty string clears the field. These are optional here so an admin can
// save a half-complete pending registration while still collecting details
// on a call — completeness is enforced at manual-payment time instead (see
// missingRegistrationFields in lib/manual-payment.ts).
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalMatch = (regex: RegExp, message: string) =>
  z.string().trim().toUpperCase().regex(regex, message).optional().or(z.literal(""));

// Child Runner never collects these (see 0014_child_runner.sql) — only
// accepted when editing a non-child registration.
const nonChildFieldsSchema = z.object({
  phone: z.string().regex(phoneRegex, "Enter a valid 10-digit mobile number"),
  gender: z.enum(GENDERS),
  city: z.string().trim().min(2, "City is required").max(80),
  tshirtSize: z.enum(TSHIRT_SIZES),
  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Enter a valid date of birth"),
  emergencyPhone: z
    .string()
    .regex(phoneRegex, "Enter a valid 10-digit emergency contact number")
    .optional()
    .or(z.literal("")),
  organization: optionalText(120),
  runningCommunity: optionalText(120),
  aadharNumber: optionalMatch(aadharRegex, "Enter a valid 12-digit Aadhar number"),
  bankNameLocation: optionalText(160),
  bankAccountNumber: optionalMatch(bankAccountRegex, "Enter a valid bank account number"),
  bankIfsc: optionalMatch(ifscRegex, "Enter a valid IFSC code"),
  panNumber: optionalMatch(panRegex, "Enter a valid PAN number"),
  acceptedTerms: z.boolean().optional(),
});

const EDITABLE_REGISTRATION_COLUMNS =
  "id, full_name, email, phone, gender, city, date_of_birth, tshirt_size, emergency_phone, organization, running_community, aadhar_number, bank_name_location, bank_account_number, bank_ifsc, pan_number, accepted_waiver, accepted_rules, bib_number, checked_in, poc_name, ticket_category_id, payment_status";

/** Full record for the edit dialog — fetched on open rather than shipping KYC fields for every listed row. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("registrations")
    .select(EDITABLE_REGISTRATION_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("admin registration fetch failed", error);
    return NextResponse.json({ error: "Could not load registration" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }
  return NextResponse.json({ registration: data });
}

type CurrentCategory = {
  group: string;
  hidden_from_picker: boolean;
  bib_prefix: string | null;
  bib_fixed_label: string | null;
} | null;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: current } = await supabase
    .from("registrations")
    .select(
      "id, event_id, ticket_category_id, ticket_categories(group, hidden_from_picker, bib_prefix, bib_fixed_label)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const currentCategory = current.ticket_categories as unknown as CurrentCategory;
  const isChildRunner = currentCategory?.hidden_from_picker ?? false;

  const schema = isChildRunner ? baseUpdateSchema : baseUpdateSchema.extend(nonChildFieldsSchema.shape);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const data = parsed.data as z.infer<typeof baseUpdateSchema> & Partial<z.infer<typeof nonChildFieldsSchema>>;

  const update: Record<string, unknown> = {
    full_name: data.fullName,
    email: data.email || null,
    checked_in: data.checkedIn,
  };
  if (data.pocName !== undefined) update.poc_name = data.pocName || null;

  if (!isChildRunner) {
    update.phone = data.phone;
    update.gender = data.gender;
    update.city = data.city;
    update.tshirt_size = data.tshirtSize;
    // Only touch the extended fields when the client sent them, so an older
    // client (or any caller that only edits the basics) can't wipe them.
    if (data.dateOfBirth !== undefined) update.date_of_birth = data.dateOfBirth || null;
    if (data.emergencyPhone !== undefined) update.emergency_phone = data.emergencyPhone || null;
    if (data.organization !== undefined) update.organization = data.organization || null;
    if (data.runningCommunity !== undefined) update.running_community = data.runningCommunity || null;
    if (data.aadharNumber !== undefined) update.aadhar_number = data.aadharNumber || null;
    if (data.bankNameLocation !== undefined) update.bank_name_location = data.bankNameLocation || null;
    if (data.bankAccountNumber !== undefined) update.bank_account_number = data.bankAccountNumber || null;
    if (data.bankIfsc !== undefined) update.bank_ifsc = data.bankIfsc || null;
    if (data.panNumber !== undefined) update.pan_number = data.panNumber || null;
  }
  if (data.acceptedTerms !== undefined) {
    update.accepted_waiver = data.acceptedTerms;
    update.accepted_rules = data.acceptedTerms;
  }

  let bibNumberOverride: string | null | undefined;

  if (data.ticketCategoryId && data.ticketCategoryId !== current.ticket_category_id) {
    if (isChildRunner) {
      return NextResponse.json({ error: "Child Runner's category can't be changed" }, { status: 400 });
    }

    const { data: newCategory } = await supabase
      .from("ticket_categories")
      .select("id, event_id, group, hidden_from_picker, bib_prefix, bib_fixed_label, is_active")
      .eq("id", data.ticketCategoryId)
      .maybeSingle();

    if (!newCategory || !newCategory.is_active || newCategory.event_id !== current.event_id) {
      return NextResponse.json({ error: "Selected category is not available" }, { status: 400 });
    }
    if (newCategory.hidden_from_picker) {
      return NextResponse.json({ error: "Can't switch a registration into Child Runner" }, { status: 400 });
    }
    if (!currentCategory || newCategory.group !== currentCategory.group) {
      return NextResponse.json(
        { error: "Can only switch to another category in the same competitive/non-competitive group" },
        { status: 400 }
      );
    }

    update.ticket_category_id = newCategory.id;

    // Different distance/pool — the old BIB no longer matches. Clear it so
    // the set_bib_number trigger reassigns one from the new category's pool
    // on this same UPDATE, instead of leaving a BIB drawn from the wrong
    // distance's pool on the ticket. The old number goes back into
    // bib_released and is reissued to the next runner of that distance
    // (0020_reuse_retired_bibs.sql).
    const poolChanged =
      newCategory.bib_prefix !== currentCategory.bib_prefix ||
      newCategory.bib_fixed_label !== currentCategory.bib_fixed_label;
    if (poolChanged) bibNumberOverride = null;
  }

  update.bib_number = bibNumberOverride !== undefined ? bibNumberOverride : data.bibNumber || null;

  const { error } = await supabase.from("registrations").update(update).eq("id", id);

  if (error) {
    // 23505 = unique_violation — the partial unique index on bib_number
    // (see 0016_bib_number.sql) rejects a duplicate here, so a re-alloted or
    // manually-typed BIB can never collide with one already assigned.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That BIB number is already assigned to another registration." },
        { status: 409 }
      );
    }
    console.error("admin registration update failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
