import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyGroupPaid, notifyRegistrationPaid } from "@/lib/notify";
import {
  MANUAL_PAYMENT_MODES,
  missingRegistrationFields,
  OVERRIDABLE_STATUSES,
  type CompletenessInput,
} from "@/lib/manual-payment";

export const runtime = "nodejs";

type BookingRow = CompletenessInput & {
  id: string;
  group_id: string | null;
  payment_status: string;
  amount_inr: number;
  ticket_categories: {
    name: string;
    price_inr: number;
    requires_kyc: boolean;
    hidden_from_picker: boolean;
  } | null;
};

const BOOKING_COLUMNS =
  "id, group_id, payment_status, amount_inr, full_name, phone, gender, city, date_of_birth, tshirt_size, emergency_phone, aadhar_number, bank_name_location, bank_account_number, bank_ifsc, accepted_waiver, accepted_rules, ticket_categories(name, price_inr, requires_kyc, hidden_from_picker)";

/**
 * Every row of the booking this registration belongs to. The override always
 * applies to the whole booking: the shared ticket page
 * (register/success?group=...) only renders once *every* attendee in the
 * booking is paid, and they all shared one abandoned Razorpay order anyway.
 */
async function loadBooking(supabase: ReturnType<typeof createServiceClient>, id: string) {
  const { data: target } = await supabase
    .from("registrations")
    .select("id, group_id")
    .eq("id", id)
    .maybeSingle();
  if (!target) return null;

  const query = supabase.from("registrations").select(BOOKING_COLUMNS).order("created_at", { ascending: true });
  const { data } = target.group_id
    ? await query.eq("group_id", target.group_id)
    : await query.eq("id", target.id);

  return { groupId: target.group_id as string | null, rows: (data ?? []) as unknown as BookingRow[] };
}

function isOverridable(status: string) {
  return (OVERRIDABLE_STATUSES as readonly string[]).includes(status);
}

function describe(rows: BookingRow[]) {
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    category: r.ticket_categories?.name ?? null,
    categoryPrice: r.ticket_categories ? Number(r.ticket_categories.price_inr) : null,
    paymentStatus: r.payment_status,
    amountInr: Number(r.amount_inr),
    missing: isOverridable(r.payment_status) ? missingRegistrationFields(r, r.ticket_categories) : [],
  }));
}

/** Preview for the "Mark as paid" dialog: who's in the booking and what's still missing. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await loadBooking(createServiceClient(), id);
  if (!booking || booking.rows.length === 0) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  return NextResponse.json({ attendees: describe(booking.rows) });
}

const markPaidSchema = z
  .object({
    mode: z.enum(MANUAL_PAYMENT_MODES),
    reference: z.string().trim().max(120).optional().or(z.literal("")),
    note: z.string().trim().max(500).optional().or(z.literal("")),
    amounts: z.record(z.string().uuid(), z.number().min(0).max(1_000_000)),
  })
  .refine((d) => !(d.mode === "upi" || d.mode === "bank_transfer") || !!d.reference, {
    message: "Transaction / UTR reference is required for UPI and bank transfers",
    path: ["reference"],
  });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = markPaidSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  const { id } = await params;
  const supabase = createServiceClient();
  const booking = await loadBooking(supabase, id);
  if (!booking || booking.rows.length === 0) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const targets = booking.rows.filter((r) => isOverridable(r.payment_status));
  if (targets.length === 0) {
    return NextResponse.json({ error: "Nothing in this booking is pending or failed" }, { status: 409 });
  }

  // A refunded/cancelled attendee alongside pending ones would leave the
  // booking's ticket page permanently stuck — don't half-confirm it.
  const blocked = booking.rows.filter((r) => r.payment_status !== "paid" && !isOverridable(r.payment_status));
  if (blocked.length > 0) {
    return NextResponse.json(
      { error: `This booking has ${blocked.map((r) => `${r.full_name} (${r.payment_status})`).join(", ")} — resolve that first.` },
      { status: 409 }
    );
  }

  const incomplete = targets
    .map((r) => ({ name: r.full_name, missing: missingRegistrationFields(r, r.ticket_categories) }))
    .filter((r) => r.missing.length > 0);
  if (incomplete.length > 0) {
    return NextResponse.json(
      {
        error: `Complete the registration first — ${incomplete
          .map((r) => `${r.name}: ${r.missing.join(", ")}`)
          .join("; ")}`,
      },
      { status: 400 }
    );
  }

  const ids = targets.map((r) => r.id);
  const amounts = ids.map((rid) => data.amounts[rid]);
  if (amounts.some((a) => a === undefined)) {
    return NextResponse.json({ error: "Enter the amount received for every attendee" }, { status: 400 });
  }

  const { data: updated, error } = await supabase.rpc("admin_mark_paid", {
    p_ids: ids,
    p_amounts: amounts,
    p_mode: data.mode,
    p_ref: data.reference || null,
    p_note: data.note || null,
    p_admin: session.email,
  });

  if (error) {
    console.error("admin_mark_paid failed", ids, error);
    return NextResponse.json({ error: "Could not mark as paid" }, { status: 500 });
  }

  // SETOF uuid comes back as bare values; tolerate the {fn_name: value}
  // row shape too rather than silently treating a success as "nothing updated".
  const updatedIds = ((updated ?? []) as unknown[])
    .map((v) => (typeof v === "string" ? v : (v as { admin_mark_paid?: string } | null)?.admin_mark_paid))
    .filter((v): v is string => Boolean(v));
  if (updatedIds.length === 0) {
    // Every row changed status between the preview and now — most likely a
    // late Razorpay webhook confirmed the original payment.
    return NextResponse.json(
      { error: "This booking was already marked paid (possibly by Razorpay) — refresh to see it." },
      { status: 409 }
    );
  }

  // Same post-payment sequence as payment-fulfillment.ts: Booking ID first,
  // so every notification can link to the shared ticket page.
  if (booking.groupId) {
    const total = booking.rows.reduce(
      (sum, r) => sum + (ids.includes(r.id) ? data.amounts[r.id] : Number(r.amount_inr)),
      0
    );
    await supabase.from("registration_groups").update({ amount_total_inr: total }).eq("id", booking.groupId);

    const { error: bookingCodeError } = await supabase.rpc("assign_booking_code", {
      p_group_id: booking.groupId,
    });
    if (bookingCodeError) {
      console.error("manual payment: assign_booking_code failed", booking.groupId, bookingCodeError);
    }
    await notifyGroupPaid(booking.groupId);
  } else {
    await notifyRegistrationPaid(updatedIds[0]);
  }

  const { data: finalRows } = await supabase
    .from("registrations")
    .select("id, full_name, registration_code, bib_number")
    .in("id", updatedIds);

  return NextResponse.json({ ok: true, registrations: finalRows ?? [] });
}
