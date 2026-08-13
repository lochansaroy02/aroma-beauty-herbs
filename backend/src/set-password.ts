/**
 * Development helper: sets an account's password, and optionally marks the
 * email verified so it can log in.
 *
 *   npm run set:password -- you@example.com "new-password" --verify
 *
 * There is no self-service password reset yet, so this is the way back into an
 * account whose password has been lost.
 */
import bcrypt from "bcryptjs";

import { prisma } from "./lib/prisma";

const SALT_ROUNDS = 12;

async function main() {
  const args = process.argv.slice(2);
  const verify = args.includes("--verify");
  const [email, password] = args.filter((arg) => !arg.startsWith("--"));

  if (!email || !password) {
    console.error(
      'Usage: npm run set:password -- <email> "<new-password>" [--verify]'
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase(), deleted_at: null },
    select: { id: true, email: true, role_as: true, email_verified_at: true },
  });

  if (!user) {
    console.error(`No account found for ${email}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(password, SALT_ROUNDS),
      status: "1",
      // Clear any half-finished verification so the new password works cleanly.
      otp: null,
      otp_expires_at: null,
      otp_attempts: 0,
      otp_last_sent_at: null,
      ...(verify ? { email_verified_at: user.email_verified_at ?? new Date() } : {}),
    },
    select: { email: true, role_as: true, email_verified_at: true },
  });

  console.log(`Password updated for ${updated.email} (role: ${updated.role_as ?? "Customer"}).`);

  if (!updated.email_verified_at) {
    console.warn(
      "This account is still unverified, so login will return 403. " +
        "Re-run with --verify, or verify it through the app."
    );
  }

  await prisma.$disconnect();
}

void main();
