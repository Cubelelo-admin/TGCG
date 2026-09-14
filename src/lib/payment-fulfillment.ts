import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyRegistrationPaid, notifyGroupPaid } from "@/lib/notify";

/**
 * Marks every registration row sharing a Razorpay order id as paid, in one
 * atomic UPDATE, then fires notifications exactly once. Called from both
 * /api/razorpay/verify (client-triggered) and the webhook (source of
 * truth) — whichever runs first flips all matching rows; the other's
 * identical UPDATE then matches zero rows and safely no-ops, so a race
 * between the two can never double-notify or partially notify a group.
 */
export async function markOrderPaidAndNotify(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
  paymentId: string | null,
  signature: string | null
): Promise<{ found: boolean }> {
  const { data: rows } = await supabase
    .from("registrations")
    .select("id, group_id")
    .eq("razorpay_order_id", orderId);

  if (!rows || rows.length === 0) {
    return { found: false };
  }

  const { data: updated } = await supabase
    .from("registrations")
    .update({
      payment_status: "paid",
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    })
    .eq("razorpay_order_id", orderId)
    .neq("payment_status", "paid")
    .select("id");

  if (updated && updated.length > 0) {
    const groupId = rows[0].group_id;
    if (groupId) {
      // Assigns the shared Booking ID (idempotent/race-safe — see
      // 0011_booking_code.sql) before notifying, so every notification can
      // link to the group's ticket page. Logged explicitly on failure —
      // this previously errored silently (e.g. a schema-cache race right
      // after the migration first ran) and left booking_code null with no
      // trace anywhere, breaking every WhatsApp/email ticket link for that
      // group. It's still best-effort: notify.ts already omits the link
      // gracefully when booking_code is null, so a failure here shouldn't
      // block the rest of the notification.
      const { error: bookingCodeError } = await supabase.rpc("assign_booking_code", {
        p_group_id: groupId,
      });
      if (bookingCodeError) {
        console.error("assign_booking_code RPC failed", groupId, bookingCodeError);
      }
      await notifyGroupPaid(groupId);
    } else {
      await notifyRegistrationPaid(updated[0].id);
    }
  }

  return { found: true };
}
