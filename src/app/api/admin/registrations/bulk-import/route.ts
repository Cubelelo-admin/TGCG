import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getBulkImportCategories } from "@/lib/catalog";
import { CHILD_RUNNER_CATEGORY_NAME } from "@/lib/registration-schema";
import { findBulkCategory, parseDateOfBirth, validateBulkRow, type BulkRowFields } from "@/lib/bulk-registration-schema";
import { notifyGroupPaid } from "@/lib/notify";

export const runtime = "nodejs";

type RowResult =
  | { index: number; ok: true; registrationCode: string | null; bibNumber: string | null }
  | { index: number; ok: false; error: string };

/**
 * Digitizes offline/paper registrations. Each row becomes its own
 * independent booking (own registration_groups row, matching the "every
 * attendee gets their own QR ticket page" design used everywhere else) —
 * inserted `pending` then immediately flipped to `paid`, the same two-step
 * sequence /api/razorpay/verify uses, so it's the update-into-'paid'
 * transition (not the insert) that fires set_bib_number, set_registration_code
 * and sync_sold_counts exactly like a real payment would. No OTP, no
 * Razorpay order — an admin typing this in is the trust boundary here,
 * unlike the public /api/register flow.
 */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rows = body?.rows as BulkRowFields[] | undefined;
  const eventId = typeof body?.eventId === "string" ? body.eventId : null;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }
  if (rows.length > 10) {
    return NextResponse.json({ error: "Send at most 10 rows per request" }, { status: 400 });
  }

  if (!eventId) {
    return NextResponse.json({ error: "No event selected" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // The event comes from the browser (the one selected in the admin header
  // when the preview was built), not the admin's current cookie — so
  // switching events in another tab mid-upload can't silently send rows to
  // a different event than the one previewed. Inactive events are allowed:
  // organizers may digitize offline registrations before the form opens.
  const { data: event } = await supabase.from("events").select("id").eq("id", eventId).maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 400 });
  }

  const categories = await getBulkImportCategories(event.id);

  // Re-validate every row server-side — never trust the browser's pass,
  // same principle as every other write path in this app. Reject the whole
  // batch rather than silently skipping bad rows, so nothing gets created
  // that the admin didn't see and confirm in the preview grid.
  const rowErrors: { index: number; errors: Record<string, string> }[] = [];
  rows.forEach((row, index) => {
    const errors = validateBulkRow(row, categories);
    if (Object.keys(errors).length > 0) {
      rowErrors.push({ index, errors });
    }
  });
  if (rowErrors.length > 0) {
    return NextResponse.json({ error: "Validation failed", rowErrors }, { status: 400 });
  }

  const results: RowResult[] = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    try {
      const category = findBulkCategory(categories, row.category)!;
      const isChild = category.name === CHILD_RUNNER_CATEGORY_NAME;
      const amountInr = Number(row.amountInr);

      const { data: group, error: groupError } = await supabase
        .from("registration_groups")
        .insert({
          event_id: event.id,
          organizer_full_name: row.fullName.trim(),
          organizer_email: row.email.trim() || null,
          attendee_count: 1,
          amount_total_inr: amountInr,
        })
        .select("id")
        .single();
      if (groupError || !group) throw new Error(groupError?.message ?? "Could not create booking");

      const { data: registration, error: insertError } = await supabase
        .from("registrations")
        .insert({
          event_id: event.id,
          ticket_category_id: category.id,
          group_id: group.id,
          amount_inr: amountInr,
          payment_status: "pending",
          // Collected offline — flagged so it's totalled apart from Razorpay
          // settlements (see 0019_manual_payments.sql).
          payment_method: "bulk_import",
          poc_name: row.pocName.trim(),
          full_name: row.fullName.trim(),
          email: row.email.trim() || null,
          phone: isChild ? null : row.phone.trim(),
          gender: isChild ? null : row.gender.trim().toLowerCase(),
          city: isChild ? null : row.city.trim(),
          organization: isChild ? null : row.organization.trim() || null,
          running_community: isChild ? null : row.runningCommunity.trim() || null,
          // validateBulkRow (above) already guarantees this parses — never
          // trust the browser's pass, so re-derive the normalized value
          // server-side rather than writing whatever raw string it sent.
          date_of_birth: isChild ? null : parseDateOfBirth(row.dateOfBirth),
          tshirt_size: isChild ? null : row.tshirtSize.trim().toUpperCase(),
          emergency_phone: isChild ? null : row.emergencyPhone.trim(),
          aadhar_number: row.aadharNumber.trim() || null,
          bank_name_location: row.bankNameLocation.trim() || null,
          bank_account_number: row.bankAccountNumber.trim() || null,
          bank_ifsc: row.bankIfsc.trim().toUpperCase() || null,
          pan_number: row.panNumber.trim().toUpperCase() || null,
          // Bulk import is an admin attesting these were collected on paper
          // at the point of offline registration — there's no per-row
          // checkbox for it the way the public flow has.
          accepted_waiver: true,
          accepted_rules: true,
        })
        .select("id")
        .single();
      if (insertError || !registration) throw new Error(insertError?.message ?? "Could not create registration");

      const { error: paidError } = await supabase
        .from("registrations")
        .update({ payment_status: "paid" })
        .eq("id", registration.id);
      if (paidError) throw new Error(paidError.message);

      const { error: bookingCodeError } = await supabase.rpc("assign_booking_code", {
        p_group_id: group.id,
      });
      if (bookingCodeError) {
        console.error("bulk import: assign_booking_code failed", group.id, bookingCodeError);
      }

      const { data: finalRow } = await supabase
        .from("registrations")
        .select("registration_code, bib_number")
        .eq("id", registration.id)
        .maybeSingle();

      await notifyGroupPaid(group.id);

      results.push({
        index,
        ok: true,
        registrationCode: finalRow?.registration_code ?? null,
        bibNumber: finalRow?.bib_number ?? null,
      });
    } catch (err) {
      console.error("bulk import row failed", index, err);
      results.push({ index, ok: false, error: err instanceof Error ? err.message : "Import failed" });
    }
  }

  return NextResponse.json({ results });
}
