import { randomInt } from "node:crypto";

import bcrypt from "bcryptjs";

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Cheaper than the password cost — OTPs live for minutes, and verify is hot. */
const OTP_SALT_ROUNDS = 8;

/** Cryptographically random 6-digit code, zero-padded (so "004321" is valid). */
export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_LENGTH, "0");
}

export function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, OTP_SALT_ROUNDS);
}

export function compareOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

export function otpExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + OTP_TTL_MINUTES * 60_000);
}

/**
 * Seconds a caller must still wait before another code can be sent,
 * or 0 when a resend is allowed.
 */
export function resendCooldownRemaining(
  lastSentAt: Date | null,
  now: Date
): number {
  if (!lastSentAt) return 0;
  const elapsed = (now.getTime() - lastSentAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed));
}
