import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendWhatsAppTemplate } from "@/lib/aisensy";
import { sendEmail } from "@/lib/email";

type RegistrationForNotify = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  phone_country_code: string;
  amount_inr: number;
  ticket_categories?: { name?: string } | null;
};

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
      "id, full_name, email, phone, phone_country_code, amount_inr, ticket_categories(name)"
    )
    .eq("id", registrationId)
    .maybeSingle();

  const registration = data as unknown as RegistrationForNotify | null;
  if (!registration) return;

  await Promise.all([
    sendWhatsAppConfirmation(supabase, registration),
    sendEmailConfirmation(supabase, registration),
  ]);
}

async function sendWhatsAppConfirmation(
  supabase: ReturnType<typeof createServiceClient>,
  registration: RegistrationForNotify
) {
  const campaignName = process.env.AISENSY_REGISTRATION_CAMPAIGN;
  if (!campaignName) {
    console.warn(
      "AISENSY_REGISTRATION_CAMPAIGN not set — skipping WhatsApp confirmation"
    );
    return;
  }

  const ticketName = registration.ticket_categories?.name ?? "TGCG 2026";
  const destination = `${registration.phone_country_code}${registration.phone}`;

  try {
    const result = await sendWhatsAppTemplate({
      campaignName,
      destinationPhoneE164: destination,
      userName: registration.full_name,
      templateParams: [registration.full_name, ticketName, String(registration.amount_inr)],
    });

    await supabase.from("wa_message_log").insert({
      registration_id: registration.id,
      channel: "whatsapp",
      template_name: campaignName,
      status: "sent",
      provider_message_id: (result.submitted_message_id as string) ?? null,
    });
  } catch (err) {
    console.error("AiSensy send failed", err);
    await supabase.from("wa_message_log").insert({
      registration_id: registration.id,
      channel: "whatsapp",
      template_name: campaignName,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function sendEmailConfirmation(
  supabase: ReturnType<typeof createServiceClient>,
  registration: RegistrationForNotify
) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping confirmation email");
    return;
  }

  const ticketName = registration.ticket_categories?.name ?? "TGCG 2026";
  const amount = Number(registration.amount_inr).toLocaleString("en-IN");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #059669;">You're registered for LetsRun TGCG 2026!</h2>
      <p>Hi ${registration.full_name},</p>
      <p>Your registration is confirmed.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #555;">Category</td><td style="padding: 6px 0; text-align: right;"><strong>${ticketName}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Amount Paid</td><td style="padding: 6px 0; text-align: right;"><strong>₹${amount}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Event Date</td><td style="padding: 6px 0; text-align: right;"><strong>20 Dec 2026, 4:00 AM IST</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Venue</td><td style="padding: 6px 0; text-align: right;"><strong>Ekatma Path Park, Raipur</strong></td></tr>
      </table>
      <p>See you at the start line!</p>
      <p style="color: #888; font-size: 12px;">LetsRun Team &middot; letsrunteam@gmail.com &middot; WhatsApp: 830-5387786</p>
    </div>
  `;
  const text = `Hi ${registration.full_name}, your registration for LetsRun TGCG 2026 is confirmed. Category: ${ticketName}. Amount paid: Rs ${amount}. Event: 20 Dec 2026, 4:00 AM IST at Ekatma Path Park, Raipur. See you at the start line! - LetsRun Team`;

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
