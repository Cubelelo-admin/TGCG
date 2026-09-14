import "server-only";
import { OAuth2Client } from "google-auth-library";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN_CLIENT_ID;
const client = new OAuth2Client(clientId);

/**
 * Verifies a Google Identity Services ID token server-side. Never trust the
 * email a client sends directly — this is the only source of truth for the
 * verified email address used on a registration.
 */
export async function verifyGoogleIdToken(
  idToken: string
): Promise<{ email: string; name: string | null; sub: string } | null> {
  if (!clientId || !idToken) return null;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified || !payload.sub) return null;
    return { email: payload.email.toLowerCase(), name: payload.name ?? null, sub: payload.sub };
  } catch {
    return null;
  }
}
