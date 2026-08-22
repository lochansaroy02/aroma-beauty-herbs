import { randomUUID } from "node:crypto";

import nodemailer, { type Transporter } from "nodemailer";

import {
  env,
  isMailFromAligned,
  isProduction,
  isSmtpConfigured,
  isSmtpIncomplete,
  mailFromAddress,
} from "./env";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isSmtpConfigured) return null;

  // Sender identity lives on the message rather than in createTransport's
  // `defaults`: a `headers` object passed to sendMail replaces the default one
  // wholesale instead of merging, so splitting them across the two loses
  // whichever half the call site didn't set.
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },

    // One held connection instead of a fresh TCP+TLS+AUTH handshake per code.
    // Signup bursts are the normal case, and repeated connections from one IP
    // are also what providers throttle hardest.
    pool: true,
    maxConnections: 3,
    maxMessages: 100,

    // Without these a black-holed SMTP port hangs the signup request until the
    // client gives up, which reads to the user as a broken site.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return transporter;
}

type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Overrides MAIL_REPLY_TO — a contact notification replies to the customer. */
  replyTo?: string;
};

async function send(mail: Mail): Promise<void> {
  const transport = getTransporter();

  if (!transport) {
    const reason = isSmtpIncomplete
      ? "SMTP_USER/SMTP_PASSWORD not set"
      : "SMTP_HOST not set";

    // In production a silent console fallback is worse than an error: signup
    // appears to succeed, nobody receives a code, and the code itself is left
    // sitting in the server logs. Fail loudly instead.
    if (isProduction) {
      throw new Error(
        `Refusing to send mail with no SMTP configured (${reason}). ` +
          "Set the SMTP_* variables in backend/.env."
      );
    }

    console.log(
      `\n──── EMAIL (${reason}) ────\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n─────────────────────────────────────\n`
    );
    return;
  }

  // The message's own Reply-To wins; MAIL_REPLY_TO is only the fallback. Order
  // matters here — spreading `mail` last would let an absent key blank it.
  const replyTo = mail.replyTo || env.MAIL_REPLY_TO;

  await transport.sendMail({
    ...mail,
    from: env.MAIL_FROM,
    ...(replyTo ? { replyTo } : {}),
    headers: {
      // RFC 3834 and the Microsoft equivalent: this is machine-generated, so
      // don't answer it with an out-of-office. Auto-replies to a no-reply
      // address generate bounces, and bounces are what wreck a sender score.
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
      // Gmail collapses same-subject mail from one sender into a single thread,
      // which hides the newest code under the oldest. A unique reference per
      // message keeps each code its own conversation.
      "X-Entity-Ref-ID": randomUUID(),
    },
    // Return-Path — where bounces go. Pinning it to the authenticated account
    // keeps it aligned with SPF even when the visible From is a brand address.
    envelope: { from: env.SMTP_USER || mailFromAddress, to: mail.to },
  });
}

/* ── The message ──────────────────────────────────────────────────────────
   Built to survive a spam filter rather than to look impressive: no images,
   no external stylesheet, no tracking pixel, no link shortener, a real
   text/plain alternative, and a small HTML part in table markup that renders
   the same in Outlook as in Gmail. A bare-HTML mail with one link and no text
   part is the classic phishing shape, and gets scored like one.            */

const INK = "#0E140F";
const INK_SOFT = "#414B43";
const LEAF = "#007A55";
const PAPER = "#F6F3EA";
const PAPER_DEEP = "#ECE8DC";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Notifies the shop that someone used the contact form.
 *
 * Reply-To is the customer, not us: hitting reply in the inbox should open a
 * message back to them, which is the whole point of the notification. The From
 * stays our own authenticated address, because sending as the customer's domain
 * would fail SPF and land the lot in spam.
 */
export function sendContactEmail(input: {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  reference: number;
}) {
  const subject = input.subject?.trim()
    ? `Contact: ${input.subject.trim()}`
    : `Contact form message from ${input.name}`;

  const lines = [
    `From:    ${input.name} <${input.email}>`,
    input.phone ? `Phone:   ${input.phone}` : null,
    `Ref:     #${input.reference}`,
  ].filter(Boolean);

  return send({
    to: env.CONTACT_EMAIL || env.SMTP_USER,
    replyTo: input.email,
    subject,
    text: `${lines.join("\n")}\n\n${input.message}\n`,
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid ${PAPER_DEEP};border-radius:12px;">
<tr><td style="padding:24px;">
<p style="margin:0 0 16px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${LEAF};font-weight:600;">New enquiry · #${input.reference}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:14px;color:${INK};">
<tr><td style="padding:2px 0;color:${INK_SOFT};width:80px;">Name</td><td style="padding:2px 0;">${escapeHtml(input.name)}</td></tr>
<tr><td style="padding:2px 0;color:${INK_SOFT};">Email</td><td style="padding:2px 0;"><a href="mailto:${escapeHtml(input.email)}" style="color:${LEAF};">${escapeHtml(input.email)}</a></td></tr>
${input.phone ? `<tr><td style="padding:2px 0;color:${INK_SOFT};">Phone</td><td style="padding:2px 0;">${escapeHtml(input.phone)}</td></tr>` : ""}
</table>
<hr style="border:none;border-top:1px solid ${PAPER_DEEP};margin:16px 0;">
<p style="margin:0;font-size:15px;line-height:1.6;color:${INK};white-space:pre-wrap;">${escapeHtml(input.message)}</p>
</td></tr>
</table>
</body>
</html>`,
  });
}

/** Verifies SMTP credentials at boot so misconfiguration surfaces early. */
export async function verifyMailer(): Promise<void> {
  const transport = getTransporter();

  if (!transport) {
    if (isSmtpIncomplete) {
      console.error(
        `SMTP_HOST is set to ${env.SMTP_HOST} but SMTP_USER/SMTP_PASSWORD are empty — ` +
          "check the names in backend/.env (GMAIL_USER and GMAIL_APP_PASSWORD are not read)."
      );
    } else {
      console.warn("SMTP not configured — contact emails will be logged to the console.");
    }
    return;
  }

  if (!isMailFromAligned) {
    console.warn(
      `MAIL_FROM (${mailFromAddress}) is not a domain ${env.SMTP_USER} can authenticate for. ` +
        "Gmail will rewrite it; other providers will fail SPF/DKIM alignment and land in spam. " +
        `Set MAIL_FROM to ${env.SMTP_USER}, or send through a provider where you own the domain.`
    );
  }

  try {
    await transport.verify();
    console.log(`SMTP ready (${env.SMTP_HOST}:${env.SMTP_PORT} as ${env.SMTP_USER})`);
  } catch (error) {
    console.error("SMTP verification failed:", describeSmtpError(error));
  }
}

/** Turns opaque SMTP failures into something actionable. */
export function describeSmtpError(error: unknown): string {
  const { code, responseCode, message } = (error ?? {}) as {
    code?: string;
    responseCode?: number;
    message?: string;
  };

  if (responseCode === 530) {
    return (
      "Gmail says authentication is required (530) — the connection carried no login. " +
      "Set SMTP_USER and SMTP_PASSWORD in backend/.env, then restart."
    );
  }

  // Nodemailer 8 renamed 'NoAuth' to 'ENOAUTH'; accept both plus the SMTP code.
  if (responseCode === 535 || code === "EAUTH" || code === "ENOAUTH" || code === "NoAuth") {
    return (
      "Gmail rejected the credentials (535). Use a 16-character App Password, " +
      "not your account password — Google Account → Security → 2-Step Verification → App passwords. " +
      "App passwords require 2-Step Verification to be on."
    );
  }

  if (responseCode === 550 || responseCode === 552) {
    return `The receiving server rejected the message (${responseCode}): ${message ?? "no detail"}. This is a deliverability problem, not a credentials one.`;
  }

  if (code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNECTION") {
    return `Could not reach ${env.SMTP_HOST}:${env.SMTP_PORT} (${code}). Check the port — 587 needs SMTP_SECURE=false, 465 needs SMTP_SECURE=true.`;
  }

  return message ?? String(error);
}
