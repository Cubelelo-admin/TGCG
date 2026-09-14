import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { markOrderPaidAndNotify } from "@/lib/payment-fulfillment";

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

  if (event.event === "payment.captured") {
    await markOrderPaidAndNotify(supabase, orderId, paymentId ?? null, null);
  } else if (event.event === "payment.failed") {
    await supabase
      .from("registrations")
      .update({ payment_status: "failed" })
      .eq("razorpay_order_id", orderId)
      .eq("payment_status", "pending");
  }

  return NextResponse.json({ ok: true });
}
