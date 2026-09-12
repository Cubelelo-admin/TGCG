import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { notifyRegistrationPaid } from "@/lib/notify";

export const runtime = "nodejs";

/**
 * Source of truth for payment status. Configure this URL
 * (https://<domain>/api/razorpay/webhook) in the Razorpay dashboard
 * (Settings -> Webhooks) subscribed to payment.captured and payment.failed,
 * and set RAZORPAY_WEBHOOK_SECRET to the secret shown there.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createServiceClient();

  const paymentEntity = event?.payload?.payment?.entity;
  const orderId: string | undefined = paymentEntity?.order_id;
  const paymentId: string | undefined = paymentEntity?.id;

  if (!orderId) {
    return NextResponse.json({ ok: true }); // irrelevant event type, ack anyway
  }

  const { data: registration } = await supabase
    .from("registrations")
    .select("id, payment_status")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();

  if (!registration) {
    return NextResponse.json({ ok: true });
  }

  if (event.event === "payment.captured") {
    if (registration.payment_status !== "paid") {
      await supabase
        .from("registrations")
        .update({
          payment_status: "paid",
          razorpay_payment_id: paymentId ?? null,
        })
        .eq("id", registration.id);

      await notifyRegistrationPaid(registration.id);
    }
  } else if (event.event === "payment.failed") {
    if (registration.payment_status === "pending") {
      await supabase
        .from("registrations")
        .update({ payment_status: "failed" })
        .eq("id", registration.id);
    }
  }

  return NextResponse.json({ ok: true });
}
