import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { GENDERS, phoneRegex, TSHIRT_SIZES } from "@/lib/registration-schema";

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
});

// Child Runner never collects these (see 0014_child_runner.sql) — only
// required when editing a non-child registration.
const nonChildFieldsSchema = z.object({
  phone: z.string().regex(phoneRegex, "Enter a valid 10-digit mobile number"),
  gender: z.enum(GENDERS),
  city: z.string().trim().min(2, "City is required").max(80),
  tshirtSize: z.enum(TSHIRT_SIZES),
});

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

  if (!isChildRunner) {
    update.phone = data.phone;
    update.gender = data.gender;
    update.city = data.city;
    update.tshirt_size = data.tshirtSize;
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
    // the existing set_bib_number trigger (0016_bib_number.sql) reassigns a
    // fresh one from the new category's pool on this same UPDATE, instead
    // of leaving a BIB drawn from the wrong distance's pool on the ticket.
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
