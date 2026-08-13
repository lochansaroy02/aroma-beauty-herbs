import { createHash } from "node:crypto";

import type { Request, Response } from "express";
import { z } from "zod";

import { env } from "../lib/env";
import { HttpError } from "../lib/http-error";
import { describeSmtpError, sendContactEmail } from "../lib/mailer";
import { prisma } from "../lib/prisma";

/**
 * The contact form.
 *
 * The message is written to the database first and emailed second, so a bounced
 * notification, a full inbox or an SMTP outage costs a notification rather than
 * a customer's message. The row is the record; the email is a convenience.
 */

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please give your name").max(120),
  email: z.email("That doesn't look like an email address").max(200),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+\-\s()]*$/, "Use digits, spaces, + and - only")
    .optional()
    .or(z.literal("")),
  subject: z.string().trim().max(150).optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Please give us a little more detail")
    .max(4000, "That's longer than we can accept — please trim it"),
  /**
   * Honeypot. A real person never sees this field, so anything in it is a bot.
   * Named plausibly on purpose — "honeypot" would be skipped by anything smart.
   */
  website: z.string().max(200).optional(),
});

/** Salted so the stored value can't be reversed into an address by guessing. */
function hashIp(req: Request): string | null {
  const raw =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress;

  if (!raw) return null;
  return createHash("sha256").update(`${raw}:${env.JWT_SECRET}`).digest("hex").slice(0, 64);
}

/** How many messages one address may send per window, and how long that is. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MINUTES = 30;

/** POST /contact — public. */
export async function submitContact(req: Request, res: Response) {
  const parsed = contactSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const input = parsed.data;

  // A filled honeypot is a bot. Answer 200 anyway — telling it that it was
  // caught only teaches whoever wrote it to stop filling the field.
  if (input.website && input.website.trim().length > 0) {
    return res.status(200).json({ received: true });
  }

  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000);
  const recent = await prisma.contactMessage.count({
    where: { email: input.email, created_at: { gte: since } },
  });

  if (recent >= RATE_LIMIT) {
    throw new HttpError(
      429,
      `That's ${RATE_LIMIT} messages in ${RATE_WINDOW_MINUTES} minutes — we've got them. We'll be in touch shortly.`
    );
  }

  const saved = await prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      subject: input.subject || null,
      message: input.message,
      ip_hash: hashIp(req),
    },
    select: { id: true },
  });

  /**
   * Deliberately not awaited. The row above is the record, so the customer has
   * no reason to sit through an SMTP handshake — which against Gmail is several
   * seconds — before the page tells them it worked. The send marks the row when
   * it lands and logs when it doesn't; either way the message is already safe.
   *
   * Safe here because this is a long-running server. On a serverless platform
   * the process can be frozen after the response, and this would need a queue.
   */
  void sendContactEmail({
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    subject: input.subject || null,
    message: input.message,
    reference: saved.id,
  })
    .then(() =>
      prisma.contactMessage.update({
        where: { id: saved.id },
        data: { notified: true },
      })
    )
    .catch((error: unknown) => {
      console.error(
        `Contact message #${saved.id} saved but not emailed:`,
        describeSmtpError(error)
      );
    });

  return res.status(201).json({ received: true, reference: saved.id });
}
