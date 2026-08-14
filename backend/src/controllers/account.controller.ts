import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error";
import { signAuthToken } from "../lib/jwt";
import { sendOtpEmail } from "../lib/mailer";
import {
  OTP_MAX_ATTEMPTS,
  compareOtp,
  generateOtp,
  hashOtp,
  otpExpiryFrom,
  resendCooldownRemaining,
} from "../lib/otp";
import { prisma } from "../lib/prisma";
import {
  changePasswordSchema,
  createAddressSchema,
  updateAddressSchema,
  updateProfileSchema,
  verifyEmailChangeSchema,
} from "../schemas/account.schema";

/**
 * The customer's own account area: order totals, saved addresses, and the
 * profile edits that need proof — a new email address has to be verified, and
 * a new password has to be authorised by the old one.
 *
 * Every route here is mounted behind requireAuth and scoped to req.auth.userId.
 * Nothing takes a user id from the request body, so there is no id to tamper
 * with.
 */

const SALT_ROUNDS = 12;

/** Delivered is the only terminal success; cancelled is terminal failure. */
const SUCCESSFUL_STATUSES = ["delivered"];
const CANCELLED_STATUSES = ["cancelled"];

function parseOrThrow<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

function requireUserId(req: Request): number {
  if (!req.auth) throw new HttpError(401, "Authentication required");
  return req.auth.userId;
}

const addressSelect = {
  id: true,
  address_title: true,
  first_name: true,
  last_name: true,
  email: true,
  phone: true,
  address_line_1: true,
  address_line_2: true,
  city: true,
  state: true,
  zip_code: true,
  country: true,
  is_default: true,
} as const;

/* ── Dashboard ─────────────────────────────────────────────────────────── */

/**
 * GET /account/overview
 *
 * Counts only. The dashboard's recent-orders list comes from GET /orders,
 * which already serialises orders with their images — duplicating that here
 * would mean two places to fix when the payload changes. The counts are a
 * grouped query rather than a slice of that list, so they stay right for a
 * customer with more orders than the list returns.
 */
export async function getOverview(req: Request, res: Response) {
  const userId = requireUserId(req);

  const grouped = await prisma.order.groupBy({
    by: ["status"],
    where: { user_id: userId },
    _count: { _all: true },
  });

  let total = 0;
  let successful = 0;
  let cancelled = 0;

  for (const row of grouped) {
    const count = row._count._all;
    total += count;
    if (SUCCESSFUL_STATUSES.includes(row.status)) successful += count;
    else if (CANCELLED_STATUSES.includes(row.status)) cancelled += count;
  }

  return res.status(200).json({
    stats: {
      total,
      successful,
      // Everything still in flight: placed but not yet delivered or cancelled.
      pending: total - successful - cancelled,
      cancelled,
    },
  });
}

/* ── Addresses ─────────────────────────────────────────────────────────── */

/** GET /account/addresses */
export async function listAddresses(req: Request, res: Response) {
  const userId = requireUserId(req);

  const addresses = await prisma.userAddress.findMany({
    where: { user_id: userId },
    select: addressSelect,
    // Default first, then newest — the one being used sits at the top.
    orderBy: [{ is_default: "desc" }, { id: "desc" }],
  });

  return res.status(200).json({ addresses });
}

/** POST /account/addresses */
export async function createAddress(req: Request, res: Response) {
  const userId = requireUserId(req);
  const input = parseOrThrow(createAddressSchema, req.body);

  const address = await prisma.$transaction(async (tx) => {
    const existing = await tx.userAddress.count({ where: { user_id: userId } });
    // The first address is the default whether or not the box was ticked:
    // a customer with exactly one address and no default is a checkout with
    // nothing pre-filled for no reason.
    const isDefault = input.is_default || existing === 0;

    if (isDefault && existing > 0) {
      await tx.userAddress.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false },
      });
    }

    return tx.userAddress.create({
      data: {
        user_id: userId,
        address_title: input.address_title ?? null,
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone: input.phone,
        address_line_1: input.address_line_1,
        address_line_2: input.address_line_2 ?? null,
        city: input.city,
        state: input.state,
        zip_code: input.zip_code,
        country: input.country,
        is_default: isDefault,
      },
      select: addressSelect,
    });
  });

  return res.status(201).json({ address });
}

/** Reads :id and confirms it belongs to the caller. */
async function ownedAddressId(req: Request, userId: number): Promise<number> {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid address id");

  const existing = await prisma.userAddress.findFirst({
    where: { id, user_id: userId },
    select: { id: true },
  });

  // Someone else's id reads as missing rather than forbidden, which would
  // confirm it exists.
  if (!existing) throw new HttpError(404, "Address not found");
  return existing.id;
}

/** PATCH /account/addresses/:id */
export async function updateAddress(req: Request, res: Response) {
  const userId = requireUserId(req);
  const id = await ownedAddressId(req, userId);
  const input = parseOrThrow(updateAddressSchema, req.body);

  const address = await prisma.$transaction(async (tx) => {
    if (input.is_default) {
      await tx.userAddress.updateMany({
        where: { user_id: userId, is_default: true, id: { not: id } },
        data: { is_default: false },
      });
    }

    return tx.userAddress.update({
      where: { id },
      data: {
        ...input,
        // `undefined` leaves a column alone; the optional text fields have to
        // become null explicitly when cleared.
        ...(input.address_title !== undefined
          ? { address_title: input.address_title || null }
          : {}),
        ...(input.address_line_2 !== undefined
          ? { address_line_2: input.address_line_2 || null }
          : {}),
      },
      select: addressSelect,
    });
  });

  return res.status(200).json({ address });
}

/** DELETE /account/addresses/:id */
export async function deleteAddress(req: Request, res: Response) {
  const userId = requireUserId(req);
  const id = await ownedAddressId(req, userId);

  await prisma.$transaction(async (tx) => {
    const removed = await tx.userAddress.delete({
      where: { id },
      select: { is_default: true },
    });

    if (!removed.is_default) return;

    // Deleting the default would otherwise leave the customer with several
    // addresses and no chosen one. Promote the newest survivor.
    const next = await tx.userAddress.findFirst({
      where: { user_id: userId },
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (next) {
      await tx.userAddress.update({
        where: { id: next.id },
        data: { is_default: true },
      });
    }
  });

  return res.status(204).send();
}

/* ── Profile, email and password ───────────────────────────────────────── */

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  pending_email: true,
  role_as: true,
  email_verified_at: true,
  created_at: true,
} as const;

/**
 * GET /account/profile
 *
 * Separate from /auth/me, which is the session check and returns only what a
 * session needs. This one also carries `pending_email`, so the settings screen
 * can show an email change that is still waiting on its code.
 */
export async function getProfile(req: Request, res: Response) {
  const userId = requireUserId(req);

  const user = await prisma.user.findFirst({
    where: { id: userId, deleted_at: null },
    select: profileSelect,
  });

  if (!user) throw new HttpError(404, "Account not found");

  return res.status(200).json({ user });
}

/**
 * Writes a fresh code against the account and emails it to `target`.
 *
 * A send failure clears the pending change on the way out. Leaving it set
 * would show the customer "we sent a code to <address>" for a code that does
 * not exist, and block the retry behind a resend cooldown for a message nobody
 * received.
 */
async function issueEmailChangeOtp(
  user: { id: number; name: string | null },
  target: string
): Promise<void> {
  const otp = generateOtp();
  const now = new Date();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: await hashOtp(otp),
      otp_expires_at: otpExpiryFrom(now),
      otp_attempts: 0,
      otp_last_sent_at: now,
    },
  });

  try {
    // Sent to the new address, not the current one: receiving it is the proof.
    await sendOtpEmail(target, otp, user.name);
  } catch (error) {
    await prisma.user
      .update({
        where: { id: user.id },
        data: {
          pending_email: null,
          otp: null,
          otp_expires_at: null,
          otp_attempts: 0,
          otp_last_sent_at: null,
        },
      })
      .catch(() => {
        // Already failing; a second failure here must not mask the first.
      });

    console.error("Could not send the email-change code:", error);
    throw new HttpError(
      502,
      "We couldn't send the verification code. Your email is unchanged — please try again."
    );
  }
}

/**
 * PATCH /account/profile
 *
 * Name and phone are saved immediately. A new email is not: it is parked in
 * `pending_email` and a code goes to it. Writing `email` here directly would
 * mean one typo locks someone out of the account they are signed into.
 */
export async function updateProfile(req: Request, res: Response) {
  const userId = requireUserId(req);
  const input = parseOrThrow(updateProfileSchema, req.body);

  const current = await prisma.user.findFirst({
    where: { id: userId, deleted_at: null },
    select: { id: true, name: true, email: true, otp_last_sent_at: true },
  });

  if (!current) throw new HttpError(404, "Account not found");

  const wantsEmailChange =
    input.email !== undefined && input.email !== current.email.toLowerCase();

  if (wantsEmailChange && input.email) {
    const taken = await prisma.user.findFirst({
      where: { email: input.email, id: { not: userId }, deleted_at: null },
      select: { id: true },
    });

    if (taken) throw new HttpError(409, "That email is already in use");

    const wait = resendCooldownRemaining(current.otp_last_sent_at, new Date());
    if (wait > 0) {
      throw new HttpError(429, `Please wait ${wait}s before requesting another code`, {
        retryAfterSeconds: wait,
      });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(wantsEmailChange ? { pending_email: input.email } : {}),
    },
    select: profileSelect,
  });

  if (wantsEmailChange && input.email) {
    await issueEmailChangeOtp(current, input.email);
  }

  return res.status(200).json({
    user,
    email_verification_required: wantsEmailChange,
  });
}

/** POST /account/email/resend — another code for a change already started. */
export async function resendEmailChangeOtp(req: Request, res: Response) {
  const userId = requireUserId(req);

  const user = await prisma.user.findFirst({
    where: { id: userId, deleted_at: null },
    select: { id: true, name: true, pending_email: true, otp_last_sent_at: true },
  });

  if (!user?.pending_email) {
    throw new HttpError(400, "No email change is pending");
  }

  const wait = resendCooldownRemaining(user.otp_last_sent_at, new Date());
  if (wait > 0) {
    throw new HttpError(429, `Please wait ${wait}s before requesting another code`, {
      retryAfterSeconds: wait,
    });
  }

  await issueEmailChangeOtp(user, user.pending_email);

  return res.status(200).json({ email: user.pending_email });
}

/**
 * POST /account/email/verify
 *
 * Commits the parked address. A fresh token comes back because the old one
 * carries the old email in its payload.
 */
export async function verifyEmailChange(req: Request, res: Response) {
  const userId = requireUserId(req);
  const input = parseOrThrow(verifyEmailChangeSchema, req.body);

  const user = await prisma.user.findFirst({
    where: { id: userId, deleted_at: null },
    select: {
      id: true,
      pending_email: true,
      otp: true,
      otp_expires_at: true,
      otp_attempts: true,
      role_as: true,
    },
  });

  if (!user?.pending_email) throw new HttpError(400, "No email change is pending");
  if (!user.otp || !user.otp_expires_at) {
    throw new HttpError(400, "No verification is pending. Request a new code.");
  }
  if (user.otp_expires_at.getTime() <= Date.now()) {
    throw new HttpError(400, "That code has expired. Request a new one.");
  }
  if ((user.otp_attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw new HttpError(429, "Too many incorrect attempts. Request a new code.");
  }

  if (!(await compareOtp(input.otp, user.otp))) {
    const { otp_attempts } = await prisma.user.update({
      where: { id: user.id },
      data: { otp_attempts: { increment: 1 } },
      select: { otp_attempts: true },
    });

    throw new HttpError(400, "Invalid or expired verification code", {
      attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - (otp_attempts ?? 0)),
    });
  }

  // Re-checked inside the commit: the address may have been claimed by someone
  // else between the code being sent and it coming back.
  const taken = await prisma.user.findFirst({
    where: { email: user.pending_email, id: { not: userId }, deleted_at: null },
    select: { id: true },
  });

  if (taken) {
    await prisma.user.update({
      where: { id: userId },
      data: { pending_email: null, otp: null, otp_expires_at: null, otp_attempts: 0 },
    });
    throw new HttpError(409, "That email was taken while you were verifying it");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      email: user.pending_email,
      pending_email: null,
      email_verified_at: new Date(),
      otp: null,
      otp_expires_at: null,
      otp_attempts: 0,
      otp_last_sent_at: null,
    },
    select: profileSelect,
  });

  const token = signAuthToken({
    userId: updated.id,
    email: updated.email,
    role: updated.role_as ?? "Customer",
  });

  return res.status(200).json({ user: updated, token });
}

/** DELETE /account/email/pending — abandon a change without verifying it. */
export async function cancelEmailChange(req: Request, res: Response) {
  const userId = requireUserId(req);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      pending_email: null,
      otp: null,
      otp_expires_at: null,
      otp_attempts: 0,
      otp_last_sent_at: null,
    },
    select: profileSelect,
  });

  return res.status(200).json({ user });
}

/**
 * POST /account/password
 *
 * The current password is required. Being in possession of a valid session is
 * not enough — a borrowed laptop shouldn't be able to lock the owner out.
 */
export async function changePassword(req: Request, res: Response) {
  const userId = requireUserId(req);
  const input = parseOrThrow(changePasswordSchema, req.body);

  const user = await prisma.user.findFirst({
    where: { id: userId, deleted_at: null },
    select: { id: true, password: true },
  });

  if (!user) throw new HttpError(404, "Account not found");

  if (!(await bcrypt.compare(input.current_password, user.password))) {
    throw new HttpError(422, "Validation failed", {
      current_password: ["That isn't your current password"],
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(input.new_password, SALT_ROUNDS) },
  });

  // Tokens already issued stay valid — they are stateless, and there is no
  // denylist to add them to. Sessions elsewhere therefore survive a password
  // change; revoking them needs a token store, which is a larger change.
  return res.status(200).json({ message: "Password updated" });
}
