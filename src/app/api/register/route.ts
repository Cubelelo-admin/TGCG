import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getRazorpayClient } from "@/lib/razorpay";
import { uploadKycFileToDrive } from "@/lib/drive";
import {
  registrationSchema,
  validateKycRequired,
} from "@/lib/registration-schema";

export const runtime = "nodejs";

function toStringOrUndefined(value: FormDataEntryValue | null) {
  if (value === null) return undefined;
  if (typeof value !== "string") return undefined;
  return value;
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const rawAddonIds = toStringOrUndefined(formData.get("addonIds"));
  let addonIds: string[] = [];
  try {
    addonIds = rawAddonIds ? JSON.parse(rawAddonIds) : [];
  } catch {
    return NextResponse.json({ error: "Invalid addonIds" }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse({
    ticketCategoryId: toStringOrUndefined(formData.get("ticketCategoryId")),
    addonIds,
    fullName: toStringOrUndefined(formData.get("fullName")),
    email: toStringOrUndefined(formData.get("email")),
    confirmEmail: toStringOrUndefined(formData.get("confirmEmail")),
    phone: toStringOrUndefined(formData.get("phone")),
    gender: toStringOrUndefined(formData.get("gender")),
    city: toStringOrUndefined(formData.get("city")),
    organization: toStringOrUndefined(formData.get("organization")) ?? "",
    runningCommunity: toStringOrUndefined(formData.get("runningCommunity")) ?? "",
    dateOfBirth: toStringOrUndefined(formData.get("dateOfBirth")),
    tshirtSize: toStringOrUndefined(formData.get("tshirtSize")),
    emergencyPhone: toStringOrUndefined(formData.get("emergencyPhone")),
    aadharNumber: toStringOrUndefined(formData.get("aadharNumber")) ?? "",
    bankNameLocation: toStringOrUndefined(formData.get("bankNameLocation")) ?? "",
    bankAccountNumber: toStringOrUndefined(formData.get("bankAccountNumber")) ?? "",
    bankIfsc: toStringOrUndefined(formData.get("bankIfsc")) ?? "",
    panNumber: toStringOrUndefined(formData.get("panNumber")) ?? "",
    acceptedWaiver: toStringOrUndefined(formData.get("acceptedWaiver")) === "true",
    acceptedRules: toStringOrUndefined(formData.get("acceptedRules")) === "true",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const supabase = createServiceClient();

  const { data: ticketCategory, error: ticketError } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("id", data.ticketCategoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (ticketError || !ticketCategory) {
    return NextResponse.json(
      { error: "Selected ticket category is not available" },
      { status: 400 }
    );
  }

  const kycError = validateKycRequired(data, ticketCategory.requires_kyc);
  if (kycError) {
    return NextResponse.json({ error: kycError }, { status: 400 });
  }

  if (
    ticketCategory.capacity !== null &&
    ticketCategory.sold_count >= ticketCategory.capacity
  ) {
    return NextResponse.json(
      { error: "This ticket category is sold out" },
      { status: 409 }
    );
  }

  let selectedAddons: { id: string; name: string; price_inr: number }[] = [];
  if (data.addonIds.length > 0) {
    const { data: addons, error: addonsError } = await supabase
      .from("addons")
      .select("id, name, price_inr, is_active, capacity, sold_count")
      .in("id", data.addonIds);

    if (addonsError || !addons || addons.length !== data.addonIds.length) {
      return NextResponse.json({ error: "Invalid add-on selected" }, { status: 400 });
    }
    const unavailable = addons.find(
      (a) =>
        !a.is_active || (a.capacity !== null && a.sold_count >= a.capacity)
    );
    if (unavailable) {
      return NextResponse.json(
        { error: `Add-on "${unavailable.name}" is not available` },
        { status: 409 }
      );
    }
    selectedAddons = addons;
  }

  // Amount is always computed server-side from the DB — never trust a client-sent total.
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + Number(a.price_inr), 0);
  const amountInr = Number(ticketCategory.price_inr) + addonsTotal;

  // Optional government-ID upload
  const govtIdFile = formData.get("govtIdFile");
  let govtIdFilePath: string | null = null;

  const { data: registration, error: insertError } = await supabase
    .from("registrations")
    .insert({
      event_id: ticketCategory.event_id,
      ticket_category_id: ticketCategory.id,
      amount_inr: amountInr,
      payment_status: "pending",
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      gender: data.gender,
      city: data.city,
      organization: data.organization || null,
      running_community: data.runningCommunity || null,
      date_of_birth: data.dateOfBirth,
      tshirt_size: data.tshirtSize,
      emergency_phone: data.emergencyPhone,
      aadhar_number: data.aadharNumber || null,
      bank_name_location: data.bankNameLocation || null,
      bank_account_number: data.bankAccountNumber || null,
      bank_ifsc: data.bankIfsc || null,
      pan_number: data.panNumber || null,
      accepted_waiver: data.acceptedWaiver,
      accepted_rules: data.acceptedRules,
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
      govtIdFilePath = path;
      await supabase
        .from("registrations")
        .update({ govt_id_file_path: govtIdFilePath })
        .eq("id", registration.id);

      const buffer = Buffer.from(await govtIdFile.arrayBuffer());
      await uploadKycFileToDrive({
        filename: `${data.fullName} — ${registration.id}.${ext}`,
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

  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: Math.round(amountInr * 100), // paise
      currency: "INR",
      receipt: registration.id,
      notes: {
        registration_id: registration.id,
        ticket_category: ticketCategory.name,
      },
    });

    await supabase
      .from("registrations")
      .update({ razorpay_order_id: order.id })
      .eq("id", registration.id);

    return NextResponse.json({
      registrationId: registration.id,
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
