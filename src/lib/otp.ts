import "server-only";
import crypto from "crypto";
import { phoneRegex } from "@/lib/registration-schema";

export const PHONE_REGEX = phoneRegex;

export const OTP_TTL_MINUTES = 10;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
export const OTP_MAX_ATTEMPTS = 5;
/** How long a completed verification stays valid for /api/register's server-side gate. */
export const OTP_VERIFIED_FRESHNESS_MINUTES = 60;

export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
