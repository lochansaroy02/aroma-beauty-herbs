/**
 * Checks the SMTP credentials in .env and sends one real email.
 *
 *   npm run mail:test                 → sends to SMTP_USER
 *   npm run mail:test you@gmail.com   → sends to that address
 *
 * Deliberately independent of the database, so mail problems can be diagnosed
 * on their own.
 */
import { env, isSmtpConfigured } from "./lib/env";
import { describeSmtpError, sendOtpEmail, verifyMailer } from "./lib/mailer";

async function main() {
  if (!isSmtpConfigured) {
    console.error("SMTP_HOST is empty — nothing to test. Set it in backend/.env");
    process.exit(1);
  }

  const missing = [
    !env.SMTP_USER && "SMTP_USER",
    !env.SMTP_PASSWORD && "SMTP_PASSWORD",
  ].filter(Boolean);

  if (missing.length) {
    console.error(`Missing in backend/.env: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`Host     ${env.SMTP_HOST}:${env.SMTP_PORT} (secure=${env.SMTP_SECURE})`);
  console.log(`User     ${env.SMTP_USER}`);
  console.log(`From     ${env.MAIL_FROM}`);
  console.log(`Password ${env.SMTP_PASSWORD.length} characters\n`);

  await verifyMailer();

  const to = process.argv[2] ?? env.SMTP_USER;
  console.log(`\nSending a sample code to ${to}...`);

  try {
    await sendOtpEmail(to, "123456", "there");
    console.log("Sent. Check the inbox (and the spam folder).");
  } catch (error) {
    console.error("Send failed:", describeSmtpError(error));
    process.exit(1);
  }
}

void main();
