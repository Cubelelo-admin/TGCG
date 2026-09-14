import "server-only";

const AISENSY_API_URL = "https://backend.aisensy.com/campaign/t1/api/v2";

/**
 * Sends a WhatsApp template message via AiSensy's Campaign API.
 * `templateParams` must match the {{1}}, {{2}}, ... placeholders configured
 * for `campaignName` in the AiSensy dashboard, in order.
 *
 * Docs: https://docs.aisensy.com/ — campaign name + template params are
 * account-specific, so confirm the exact template name/params with the
 * AiSensy account owner before relying on this in production.
 */
export async function sendWhatsAppTemplate(params: {
  campaignName: string;
  destinationPhoneE164: string; // e.g. "+919999999999"
  userName: string;
  templateParams: string[];
  /**
   * Fill values for the template's own buttons (e.g. a dynamic-URL button's
   * {{1}} suffix), in AiSensy's raw button-object shape. Omit for templates
   * with no buttons, or whose buttons are fully static.
   */
  buttons?: Record<string, unknown>[];
}) {
  const apiKey = process.env.AISENSY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing AISENSY_API_KEY env var");
  }

  const res = await fetch(AISENSY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      campaignName: params.campaignName,
      destination: params.destinationPhoneE164,
      userName: params.userName,
      templateParams: params.templateParams,
      ...(params.buttons ? { buttons: params.buttons } : {}),
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      `AiSensy send failed (${res.status}): ${JSON.stringify(body)}`
    );
  }

  return body as { submitted_message_id?: string; [key: string]: unknown };
}
