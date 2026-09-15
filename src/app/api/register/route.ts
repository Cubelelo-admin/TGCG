import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getRazorpayClient } from "@/lib/razorpay";
import { uploadKycFileToDrive } from "@/lib/drive";
import { OTP_VERIFIED_FRESHNESS_MINUTES } from "@/lib/otp";
import {
  groupRegistrationSchema,
  validateKycRequired,
  type AttendeeCoreInput,
} from "@/lib/registration-schema";
import type { TicketCategory } from "@/lib/types";

export const runtime = "nodejs";

type AddonRow = {
  id: string;
  name: string;
  price_inr: number;
  is_active: boolean;
  capacity: number | null;
  sold_count: number;
};

function toStringOrUndefined(value: FormDataEntryValue | null) {
  if (value === null) return undefined;
  if (typeof value !== "string") return undefined;
  return value;
}

export async function POST(request: Request) {
  const formData = await request.formData();

  let rawAttendees: unknown;
  try {
    rawAttendees = JSON.parse(String(formData.get("attendees") ?? "[]"));
  } catch {
    return NextResponse.json({ error: "Invalid attendees payload" }, { status: 400 });
  }

  const parsed = groupRegistrationSchema.safeParse({
    organizerEmail: toStringOrUndefined(formData.get("organizerEmail")),
    attendees: rawAttendees,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { attendees, organizerEmail } = parsed.data;

  const supabase = createServiceClient();

  // Hard gate: the primary (first) attendee's phone must have a fresh,
  // completed OTP verification — re-checked here since the client-side gate
  // is only UX, never the source of truth. See 0012_phone_otp.sql.
  const primaryPhone = attendees[0].phone;
  const { data: otpRow } = await supabase
    .from("phone_otp_verifications")
    .select("verified_at")
    .eq("phone", primaryPhone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const verifiedRecently =
    otpRow?.verified_at &&
    Date.now() - new Date(otpRow.verified_at).getTime() < OTP_VERIFIED_FRESHNESS_MINUTES * 60 * 1000;

  if (!verifiedRecently) {
    return NextResponse.json(
      { error: "Please verify the first participant's phone number before checking out" },
      { status: 400 }
    );
  }

  // --- Validation pass: look up every attendee's category/addons and
  // recompute prices server-side — never trust a client-sent amount. No
  // writes happen yet. Claimed counts are tracked across attendees in THIS
  // request so two attendees can't jointly over-claim a nearly-sold-out
  // category/addon.
  const categoryCache = new Map<string, { row: TicketCategory | null; claimed: number }>();
  const addonCache = new Map<string, { row: AddonRow | null; claimed: number }>();
  const attendeeErrors: { index: number; error: string }[] = [];
  const priced: {
    attendee: AttendeeCoreInput;
    ticketCategory: TicketCategory;
    selectedAddons: AddonRow[];
    amountInr: number;
  }[] = [];

  for (let i = 0; i < attendees.length; i++) {
    const attendee = attendees[i];

    let categoryEntry = categoryCache.get(attendee.ticketCategoryId);
    if (!categoryEntry) {
      const { data: row } = await supabase
        .from("ticket_categories")
        .select("*")
        .eq("id", attendee.ticketCategoryId)
        .eq("is_active", true)
        .maybeSingle();
      categoryEntry = { row, claimed: 0 };
      categoryCache.set(attendee.ticketCategoryId, categoryEntry);
    }
    if (!categoryEntry.row) {
      attendeeErrors.push({ index: i, error: "Selected ticket category is not available" });
      continue;
    }
    const ticketCategory = categoryEntry.row;

    const kycError = validateKycRequired(attendee, ticketCategory.requires_kyc);
    if (kycError) {
      attendeeErrors.push({ index: i, error: kycError });
      continue;
    }

    if (
      ticketCategory.capacity !== null &&
      ticketCategory.sold_count + categoryEntry.claimed >= ticketCategory.capacity
    ) {
      attendeeErrors.push({ index: i, error: `"${ticketCategory.name}" is sold out` });
      continue;
    }

    const selectedAddons: AddonRow[] = [];
    let addonError: string | null = null;
    for (const addonId of attendee.addonIds) {
      let addonEntry = addonCache.get(addonId);
      if (!addonEntry) {
        const { data: row } = await supabase
          .from("addons")
          .select("id, name, price_inr, is_active, capacity, sold_count")
          .eq("id", addonId)
          .maybeSingle();
        addonEntry = { row, claimed: 0 };
        addonCache.set(addonId, addonEntry);
      }
      if (!addonEntry.row || !addonEntry.row.is_active) {
        addonError = "Invalid add-on selected";
        break;
      }
      if (
        addonEntry.row.capacity !== null &&
        addonEntry.row.sold_count + addonEntry.claimed >= addonEntry.row.capacity
      ) {
        addonError = `Add-on "${addonEntry.row.name}" is not available`;
        break;
      }
      selectedAddons.push(addonEntry.row);
    }
    if (addonError) {
      attendeeErrors.push({ index: i, error: addonError });
      continue;
    }

    // This attendee fully validated — reserve their claim so a later
    // attendee in this same request sees it reflected in capacity checks.
    categoryEntry.claimed += 1;
    for (const addon of selectedAddons) {
      addonCache.get(addon.id)!.claimed += 1;
    }

    const addonsTotal = selectedAddons.reduce((sum, a) => sum + Number(a.price_inr), 0);
    const amountInr = Number(ticketCategory.price_inr) + addonsTotal;

    priced.push({ attendee, ticketCategory, selectedAddons, amountInr });
  }

  if (attendeeErrors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", attendeeErrors },
      { status: 400 }
    );
  }

  const eventId = priced[0].ticketCategory.event_id;
  const amountTotalInr = priced.reduce((sum, p) => sum + p.amountInr, 0);

  const { data: group, error: groupError } = await supabase
    .from("registration_groups")
    .insert({
      event_id: eventId,
      organizer_full_name: attendees[0].fullName,
      organizer_email: organizerEmail ?? null,
      attendee_count: priced.length,
      amount_total_inr: amountTotalInr,
    })
    .select("id")
    .single();

  if (groupError || !group) {
    console.error("registration group insert failed", groupError);
    return NextResponse.json(
      { error: "Could not create registration, please try again" },
      { status: 500 }
    );
  }

  const registrationIds: string[] = [];

  for (let i = 0; i < priced.length; i++) {
    const { attendee, ticketCategory, selectedAddons, amountInr } = priced[i];

    const { data: registration, error: insertError } = await supabase
      .from("registrations")
      .insert({
        event_id: ticketCategory.event_id,
        ticket_category_id: ticketCategory.id,
        group_id: group.id,
        amount_inr: amountInr,
        payment_status: "pending",
        full_name: attendee.fullName,
        email: organizerEmail ?? null,
        phone: attendee.phone,
        gender: attendee.gender,
        city: attendee.city,
        organization: attendee.organization || null,
        running_community: attendee.runningCommunity || null,
        date_of_birth: attendee.dateOfBirth,
        tshirt_size: attendee.tshirtSize,
        emergency_phone: attendee.emergencyPhone,
        aadhar_number: attendee.aadharNumber || null,
        bank_name_location: attendee.bankNameLocation || null,
        bank_account_number: attendee.bankAccountNumber || null,
        bank_ifsc: attendee.bankIfsc || null,
        pan_number: attendee.panNumber || null,
        accepted_waiver: attendee.acceptedWaiver,
        accepted_rules: attendee.acceptedRules,
      })
      .select("id")
      .single();

    if (insertError || !registration) {
      console.error("registration insert failed", insertError);
      return NextResponse.json(
        { error: "Could not create registration, please try again" },
        { status: 500 }
      );
    }
    registrationIds.push(registration.id);

    const govtIdFile = formData.get(`govtIdFile_${i}`);
    if (
      govtIdFile instanceof File &&
      govtIdFile.size > 0 &&
      govtIdFile.size <= 10 * 1024 * 1024
    ) {
      const ext = govtIdFile.name.split(".").pop() || "bin";
      const path = `${registration.id}/govt-id.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("govt-ids")
        .upload(path, govtIdFile, {
          contentType: govtIdFile.type || "application/octet-stream",
          upsert: true,
        });
      if (!uploadError) {
        await supabase
          .from("registrations")
          .update({ govt_id_file_path: path })
          .eq("id", registration.id);

        const buffer = Buffer.from(await govtIdFile.arrayBuffer());
        await uploadKycFileToDrive({
          filename: `${attendee.fullName} — ${registration.id}.${ext}`,
          mimeType: govtIdFile.type || "application/octet-stream",
          buffer,
        });
      } else {
        console.error("govt id upload failed", uploadError);
      }
    }

    if (selectedAddons.length > 0) {
      await supabase.from("registration_addons").insert(
        selectedAddons.map((a) => ({
          registration_id: registration.id,
          addon_id: a.id,
          quantity: 1,
          name_snapshot: a.name,
          price_inr_snapshot: a.price_inr,
        }))
      );
    }
  }

  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: Math.round(amountTotalInr * 100), // paise
      currency: "INR",
      receipt: group.id,
      notes: {
        group_id: group.id,
        attendee_count: String(priced.length),
      },
    });

    await supabase
      .from("registrations")
      .update({ razorpay_order_id: order.id })
      .eq("group_id", group.id);

    return NextResponse.json({
      groupId: group.id,
      registrationIds,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("razorpay order creation failed", err);
    return NextResponse.json(
      { error: "Could not initiate payment, please try again" },
      { status: 500 }
    );
  }
}
