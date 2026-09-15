import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendWhatsAppTemplate } from "@/lib/aisensy";
import { sendEmail } from "@/lib/email";

type RegistrationForNotify = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  phone_country_code: string;
  amount_inr: number;
  registration_code: string | null;
  ticket_categories?: { name?: string } | null;
};

/**
 * Absolute link to the shared booking ticket page (every attendee's QR from
 * one checkout, not just one person's) — see 0011_booking_code.sql. Falls
 * back to null (callers omit the link/button entirely) for pre-migration
 * rows that never got a booking_code assigned.
 */
function ticketUrl(bookingCode: string | null | undefined): string | null {
  if (!bookingCode) return null;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tgcg.vercel.app";
  return `${base.replace(/\/$/, "")}/register/success?group=${bookingCode}`;
}

/**
 * Fires the registration-confirmation WhatsApp message (AiSensy) and email
 * (Gmail SMTP), logging each attempt to wa_message_log. Each channel is
 * independent and never throws — a send failure on either channel must not
 * block/roll back a successful payment, and one channel failing shouldn't
 * skip the other.
 */
export async function notifyRegistrationPaid(registrationId: string) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("registrations")
    .select(
      "id, full_name, email, phone, phone_country_code, amount_inr, registration_code, ticket_categories(name), registration_groups(booking_code)"
    )
    .eq("id", registrationId)
    .maybeSingle();

  const registration = data as unknown as
    | (RegistrationForNotify & { registration_groups?: { booking_code: string | null } | null })
    | null;
  if (!registration) return;

  const bookingCode = registration.registration_groups?.booking_code ?? null;

  await Promise.all([
    sendWhatsAppConfirmation(supabase, registration, bookingCode),
    sendEmailConfirmation(supabase, registration, bookingCode),
  ]);
}

type GroupForNotify = {
  id: string;
  organizer_full_name: string | null;
  organizer_email: string | null;
  booking_code: string | null;
};

/**
 * Group-booking equivalent of notifyRegistrationPaid. For 2+ attendees, the
 * first-registered attendee's phone gets one "booking summary" WhatsApp
 * first (there's no verified organizer phone yet — phone-OTP verification
 * isn't built, so the first attendee's number is the closest thing to a
 * "primary" contact); then every attendee gets their own confirmation
 * WhatsApp to their own phone (falling back to emailing the organizer if
 * that send fails), plus one summary email to the organizer listing every
 * attendee. Solo (1-attendee) bookings skip the summary message — it would
 * just duplicate the confirmation that follows it. Never throws — same
 * best-effort contract as the single-registration path.
 */
export async function notifyGroupPaid(groupId: string) {
  const supabase = createServiceClient();

  const { data: group } = await supabase
    .from("registration_groups")
    .select("id, organizer_full_name, organizer_email, booking_code")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return;

  const { data: rows } = await supabase
    .from("registrations")
    .select(
      "id, full_name, email, phone, phone_country_code, amount_inr, registration_code, ticket_categories(name)"
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  const attendees = (rows ?? []) as unknown as RegistrationForNotify[];
  if (attendees.length === 0) return;

  if (attendees.length > 1) {
    await sendBookingSummaryWhatsApp(supabase, group, attendees);
  }

  await Promise.all(
    attendees.map(async (attendee) => {
      const sent = await sendWhatsAppConfirmation(supabase, attendee, group.booking_code);
      if (!sent) {
        await sendAttendeeFallbackEmail(supabase, group, attendee);
      }
    })
  );

  await sendGroupSummaryEmail(supabase, group, attendees);
}

/**
 * Sends the group-wide "booking confirmed" WhatsApp to the first attendee's
 * phone, ahead of everyone's individual confirmations. Best-effort like
 * every other channel here — a failure just gets logged; the group summary
 * email sent later in notifyGroupPaid is the real safety net.
 */
async function sendBookingSummaryWhatsApp(
  supabase: ReturnType<typeof createServiceClient>,
  group: GroupForNotify,
  attendees: RegistrationForNotify[]
) {
  const campaignName = process.env.AISENSY_BOOKING_SUMMARY_CAMPAIGN;
  if (!campaignName) {
    console.warn(
      "AISENSY_BOOKING_SUMMARY_CAMPAIGN not set — skipping booking summary WhatsApp"
    );
    return;
  }

  const primary = attendees[0];
  const total = attendees.reduce((sum, a) => sum + Number(a.amount_inr), 0);
  const destination = `${primary.phone_country_code}${primary.phone}`;

  try {
    const result = await sendWhatsAppTemplate({
      campaignName,
      destinationPhoneE164: destination,
      userName: primary.full_name,
      // 5th param fills the "View QR Ticket" button, same convention as
      // sendWhatsAppConfirmation — see the comment there.
      templateParams: [
        primary.full_name,
        String(attendees.length),
        String(total),
        group.booking_code ?? "—",
        group.booking_code ?? "—",
      ],
    });

    await supabase.from("wa_message_log").insert({
      registration_id: primary.id,
      group_id: group.id,
      channel: "whatsapp",
      template_name: campaignName,
      status: "sent",
      provider_message_id: (result.submitted_message_id as string) ?? null,
    });
  } catch (err) {
    console.error("AiSensy booking-summary send failed", err);
    await supabase.from("wa_message_log").insert({
      registration_id: primary.id,
      group_id: group.id,
      channel: "whatsapp",
      template_name: campaignName,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function sendAttendeeFallbackEmail(
  supabase: ReturnType<typeof createServiceClient>,
  group: GroupForNotify,
  attendee: RegistrationForNotify
) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;
  if (!group.organizer_email) return;

  const ticketName = attendee.ticket_categories?.name ?? "TGCG 2026";
  const amount = Number(attendee.amount_inr).toLocaleString("en-IN");
  const link = ticketUrl(group.booking_code);

  try {
    const result = await sendEmail({
      to: group.organizer_email,
      subject: `Registration details for ${attendee.full_name} (WhatsApp delivery failed)`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <p>We couldn't reach ${attendee.full_name} on WhatsApp (${attendee.phone_country_code}${attendee.phone}), so here are their registration details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px 0; color: #555;">Registration ID</td><td style="padding: 6px 0; text-align: right;"><strong>${attendee.registration_code ?? "—"}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #555;">Category</td><td style="padding: 6px 0; text-align: right;"><strong>${ticketName}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #555;">Amount Paid</td><td style="padding: 6px 0; text-align: right;"><strong>₹${amount}</strong></td></tr>
        </table>
        <p style="color: #888; font-size: 12px;">Please share these details with ${attendee.full_name} directly.</p>
        ${link ? `<p><a href="${link}">View &amp; save everyone's QR tickets from this booking</a></p>` : ""}
      </div>`,
      text: `Couldn't reach ${attendee.full_name} on WhatsApp (${attendee.phone_country_code}${attendee.phone}). Registration ID: ${attendee.registration_code ?? "—"}, Category: ${ticketName}, Amount Paid: Rs ${amount}. Please share these details with them directly.${link ? ` Tickets: ${link}` : ""}`,
    });

    await supabase.from("wa_message_log").insert({
      registration_id: attendee.id,
      group_id: group.id,
      channel: "email",
      template_name: "wa_fallback",
      status: "sent",
      provider_message_id: result.messageId ?? null,
    });
  } catch (err) {
    console.error("WA-fallback email send failed", err);
    await supabase.from("wa_message_log").insert({
      registration_id: attendee.id,
      group_id: group.id,
      channel: "email",
      template_name: "wa_fallback",
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function sendGroupSummaryEmail(
  supabase: ReturnType<typeof createServiceClient>,
  group: GroupForNotify,
  attendees: RegistrationForNotify[]
) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping group summary email");
    return;
  }
  if (!group.organizer_email) return;

  const total = attendees.reduce((sum, a) => sum + Number(a.amount_inr), 0);
  const link = ticketUrl(group.booking_code);
  const rowsHtml = attendees
    .map(
      (a) => `<tr>
        <td style="padding: 6px 0; color: #555;">${a.full_name}</td>
        <td style="padding: 6px 0;">${a.ticket_categories?.name ?? "TGCG 2026"}</td>
        <td style="padding: 6px 0;">${a.registration_code ?? "—"}</td>
        <td style="padding: 6px 0; text-align: right;">₹${Number(a.amount_inr).toLocaleString("en-IN")}</td>
      </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #059669;">You're registered for LetsRun TGCG 2026!</h2>
      <p>Hi ${group.organizer_full_name ?? "there"},</p>
      <p>Your group registration is confirmed for ${attendees.length} attendee${attendees.length === 1 ? "" : "s"}.</p>
      ${group.booking_code ? `<p style="color: #555;">Booking ID: <strong>${group.booking_code}</strong></p>` : ""}
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr style="color: #555; text-align: left;"><th>Name</th><th>Category</th><th>Reg. ID</th><th style="text-align: right;">Amount</th></tr>
        ${rowsHtml}
      </table>
      <p><strong>Total Paid: ₹${total.toLocaleString("en-IN")}</strong></p>
      ${link ? `<p><a href="${link}" style="display: inline-block; padding: 10px 18px; background: #059669; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">View &amp; save everyone's QR tickets</a></p>` : ""}
      <p>Each attendee's own WhatsApp number was also sent their ticket where possible — this link always shows every attendee's ticket regardless, so keep it handy. See you at the start line!</p>
      <p style="color: #888; font-size: 12px;">LetsRun Team &middot; letsrunteam@gmail.com &middot; WhatsApp: 830-5387786</p>
    </div>
  `;
  const text = `Hi ${group.organizer_full_name ?? "there"}, your group registration for LetsRun TGCG 2026 is confirmed (${attendees.length} attendees, total Rs ${total.toLocaleString("en-IN")}).${group.booking_code ? ` Booking ID: ${group.booking_code}.` : ""}${link ? ` View everyone's tickets: ${link}` : ""} See you at the start line! - LetsRun Team`;

  try {
    const result = await sendEmail({
      to: group.organizer_email,
      subject: `Your TGCG 2026 group registration (${attendees.length} attendees) is confirmed!`,
      html,
      text,
    });

    await supabase.from("wa_message_log").insert({
      group_id: group.id,
      channel: "email",
      template_name: "group_summary",
      status: "sent",
      provider_message_id: result.messageId ?? null,
    });
  } catch (err) {
    console.error("Group summary email send failed", err);
    await supabase.from("wa_message_log").insert({
      group_id: group.id,
      channel: "email",
      template_name: "group_summary",
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Returns true if the WhatsApp send succeeded, false if skipped/failed. */
async function sendWhatsAppConfirmation(
  supabase: ReturnType<typeof createServiceClient>,
  registration: RegistrationForNotify,
  bookingCode: string | null
): Promise<boolean> {
  const campaignName = process.env.AISENSY_REGISTRATION_CAMPAIGN;
  if (!campaignName) {
    console.warn(
      "AISENSY_REGISTRATION_CAMPAIGN not set — skipping WhatsApp confirmation"
    );
    return false;
  }

  const ticketName = registration.ticket_categories?.name ?? "TGCG 2026";
  const destination = `${registration.phone_country_code}${registration.phone}`;

  try {
    const result = await sendWhatsAppTemplate({
      campaignName,
      destinationPhoneE164: destination,
      userName: registration.full_name,
      // 5th param fills the template's "View QR Ticket" button — a dynamic
      // URL button whose base (https://.../register/success?group={{5}}) is
      // configured in the AiSensy dashboard. Per AiSensy's own API-reference
      // curl for this template, the button's fill value is just the next
      // slot in templateParams (not a separate `buttons` entry). The link
      // always points at the whole booking's ticket page (every attendee's
      // QR), not just this one, so it still resolves even if this
      // attendee's own number is wrong/unreachable and someone else opens it.
      templateParams: [
        registration.full_name,
        ticketName,
        String(registration.amount_inr),
        registration.registration_code ?? "—",
        bookingCode ?? "—",
      ],
    });

    await supabase.from("wa_message_log").insert({
      registration_id: registration.id,
      channel: "whatsapp",
      template_name: campaignName,
      status: "sent",
      provider_message_id: (result.submitted_message_id as string) ?? null,
    });
    return true;
  } catch (err) {
    console.error("AiSensy send failed", err);
    await supabase.from("wa_message_log").insert({
      registration_id: registration.id,
      channel: "whatsapp",
      template_name: campaignName,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

async function sendEmailConfirmation(
  supabase: ReturnType<typeof createServiceClient>,
  registration: RegistrationForNotify,
  bookingCode: string | null
) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping confirmation email");
    return;
  }
  if (!registration.email) return;

  const ticketName = registration.ticket_categories?.name ?? "TGCG 2026";
  const amount = Number(registration.amount_inr).toLocaleString("en-IN");
  const link = ticketUrl(bookingCode);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #059669;">You're registered for LetsRun TGCG 2026!</h2>
      <p>Hi ${registration.full_name},</p>
      <p>Your registration is confirmed.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #555;">Category</td><td style="padding: 6px 0; text-align: right;"><strong>${ticketName}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Amount Paid</td><td style="padding: 6px 0; text-align: right;"><strong>₹${amount}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Event Date</td><td style="padding: 6px 0; text-align: right;"><strong>20 Dec 2026, 4:00 AM IST</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Venue</td><td style="padding: 6px 0; text-align: right;"><strong>CBD Square, Naya Raipur</strong></td></tr>
      </table>
      ${link ? `<p><a href="${link}">View &amp; save your QR ticket</a></p>` : ""}
      <p>See you at the start line!</p>
      <p style="color: #888; font-size: 12px;">LetsRun Team &middot; letsrunteam@gmail.com &middot; WhatsApp: 830-5387786</p>
    </div>
  `;
  const text = `Hi ${registration.full_name}, your registration for LetsRun TGCG 2026 is confirmed. Category: ${ticketName}. Amount paid: Rs ${amount}. Event: 20 Dec 2026, 4:00 AM IST at CBD Square, Naya Raipur.${link ? ` Ticket: ${link}` : ""} See you at the start line! - LetsRun Team`;

  try {
    const result = await sendEmail({
      to: registration.email,
      subject: "You're registered for LetsRun TGCG 2026!",
      html,
      text,
    });

    await supabase.from("wa_message_log").insert({
      registration_id: registration.id,
      channel: "email",
      template_name: "registration_confirmation",
      status: "sent",
      provider_message_id: result.messageId ?? null,
    });
  } catch (err) {
    console.error("Confirmation email send failed", err);
    await supabase.from("wa_message_log").insert({
      registration_id: registration.id,
      channel: "email",
      template_name: "registration_confirmation",
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
