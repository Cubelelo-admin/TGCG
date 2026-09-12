import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { notifyRegistrationPaid } from "@/lib/notify";

export const runtime = "nodejs";

/**
 * Called from the browser right after Razorpay Checkout succeeds, so the user
 * gets an instant "paid" confirmation without waiting for the webhook. The
 * webhook (api/razorpay/webhook) is the source of truth and will also mark
 * the registration paid if this call never happens (tab closed, etc).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { registrationId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    body ?? {};

  if (!registrationId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const valid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: registration, error } = await supabase
    .from("registrations")
    .select("id, payment_status, razorpay_order_id")
    .eq("id", registrationId)
    .maybeSingle();

  if (error || !registration || registration.razorpay_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  if (registration.payment_status !== "paid") {
    await supabase
      .from("registrations")
      .update({
        payment_status: "paid",
        razorpay_payment_id,
        razorpay_signature,
      })
      .eq("id", registrationId);

    await notifyRegistrationPaid(registrationId);
  }

  return NextResponse.json({ ok: true });
}
