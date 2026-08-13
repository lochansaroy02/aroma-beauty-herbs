import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { z } from "zod";

import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../lib/http-error";
import { signAuthToken } from "../lib/jwt";
import { sendOtpEmail } from "../lib/mailer";
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  compareOtp,
  generateOtp,
  hashOtp,
  otpExpiryFrom,
  resendCooldownRemaining,
} from "../lib/otp";
import { prisma } from "../lib/prisma";
import {
  loginSchema,
  resendOtpSchema,
  signupSchema,
  verifyOtpSchema,
} from "../schemas/auth.schema";

const SALT_ROUNDS = 12;

const ACTIVE_STATUS = "1";
const PENDING_STATUS = "0";

/** Columns safe to send back to a client — never password/otp/remember_token. */
const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role_as: true,
  status: true,
  email_verified_at: true,
  created_at: true,
} satisfies Prisma.UserSelect;

/**
 * A real bcrypt hash of a throwaway value. When an email doesn't exist we still
 * run a comparison against it, so login takes the same time either way and
 * can't be used to enumerate registered accounts.
 */
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", SALT_ROUNDS);

function parseOrThrow<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(
      422,
      "Validation failed",
      z.flattenError(result.error).fieldErrors
    );
  }
  return result.data;
}

/** Issues a fresh code, persists its hash, and emails the plaintext. */
async function issueOtp(user: { id: number; email: string; name: string | null }) {
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

  await sendOtpEmail(user.email, otp, user.name);
}

/**
 * POST /auth/signup
 * Creates the account in a pending state and emails a code. No token is
 * returned here — the caller must verify before the account becomes usable.
 */
export async function signup(req: Request, res: Response) {
  const input = parseOrThrow(signupSchema, req.body);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  if (existing?.email_verified_at) {
    throw new HttpError(409, "An account with that email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // An unverified record means nobody has proven ownership of that address yet,
  // so it's safe to overwrite it with this attempt rather than lock the address.
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          phone: input.phone ?? null,
          password: passwordHash,
          status: PENDING_STATUS,
          deleted_at: null,
        },
        select: publicUserSelect,
      })
    : await prisma.user
        .create({
          data: {
            name: input.name,
            email: input.email,
            phone: input.phone ?? null,
            password: passwordHash,
            role_as: "Customer",
            status: PENDING_STATUS,
          },
          select: publicUserSelect,
        })
        .catch((error: unknown) => {
          // Lost a race with a concurrent signup for the same address.
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            throw new HttpError(409, "An account with that email already exists");
          }
          throw error;
        });

  await issueOtp(user);

  return res.status(201).json({
    message: `We sent a ${OTP_TTL_MINUTES}-minute verification code to ${user.email}.`,
    email: user.email,
    expiresInMinutes: OTP_TTL_MINUTES,
  });
}

/**
 * POST /auth/verify-otp
 * Completes signup. On success the account is activated and a token issued.
 */
export async function verifyOtp(req: Request, res: Response) {
  const input = parseOrThrow(verifyOtpSchema, req.body);

  const user = await prisma.user.findFirst({
    where: { email: input.email, deleted_at: null },
  });

  if (!user) {
    throw new HttpError(400, "Invalid or expired verification code");
  }

  if (user.email_verified_at) {
    throw new HttpError(409, "This email is already verified. Please log in.");
  }

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

    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - (otp_attempts ?? 0));
    throw new HttpError(400, "Invalid or expired verification code", {
      attemptsRemaining: remaining,
    });
  }

  const verified = await prisma.user.update({
    where: { id: user.id },
    data: {
      email_verified_at: new Date(),
      status: ACTIVE_STATUS,
      otp: null,
      otp_expires_at: null,
      otp_attempts: 0,
      otp_last_sent_at: null,
    },
    select: publicUserSelect,
  });

  const token = signAuthToken({
    userId: verified.id,
    email: verified.email,
    role: verified.role_as ?? "Customer",
  });

  return res.status(200).json({ user: verified, token });
}

/** POST /auth/resend-otp */
export async function resendOtp(req: Request, res: Response) {
  const input = parseOrThrow(resendOtpSchema, req.body);

  const user = await prisma.user.findFirst({
    where: { email: input.email, deleted_at: null },
  });

  // Deliberately the same reply whether or not the address is registered.
  const genericReply = {
    message: "If that account needs verification, a new code has been sent.",
  };

  if (!user || user.email_verified_at) {
    return res.status(200).json(genericReply);
  }

  const waitSeconds = resendCooldownRemaining(user.otp_last_sent_at, new Date());
  if (waitSeconds > 0) {
    throw new HttpError(
      429,
      `Please wait ${waitSeconds}s before requesting another code.`,
      { retryAfterSeconds: waitSeconds }
    );
  }

  await issueOtp(user);

  return res.status(200).json(genericReply);
}

/** POST /auth/login */
export async function login(req: Request, res: Response) {
  const input = parseOrThrow(loginSchema, req.body);

  const user = await prisma.user.findFirst({
    where: { email: input.email, deleted_at: null },
  });

  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.password ?? DUMMY_HASH
  );

  // Same message for "no such user" and "wrong password" so neither reveals
  // whether the email is registered.
  if (!user || !passwordMatches) {
    throw new HttpError(401, "Invalid email or password");
  }

  // Checked before `status`, so a pending signup gets a code the client can act
  // on rather than a generic "inactive account".
  if (!user.email_verified_at) {
    throw new HttpError(403, "Please verify your email before logging in.", {
      code: "EMAIL_NOT_VERIFIED",
      email: user.email,
    });
  }

  if (user.status !== ACTIVE_STATUS) {
    throw new HttpError(403, "This account is not active. Please contact support.");
  }

  const token = signAuthToken({
    userId: user.id,
    email: user.email,
    role: user.role_as ?? "Customer",
  });

  return res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role_as: user.role_as,
      status: user.status,
      email_verified_at: user.email_verified_at,
      created_at: user.created_at,
    },
    token,
  });
}

/** GET /auth/me — requires a valid Bearer token. */
export async function me(req: Request, res: Response) {
  if (!req.auth) {
    throw new HttpError(401, "Authentication required");
  }

  const user = await prisma.user.findFirst({
    where: { id: req.auth.userId, deleted_at: null },
    select: publicUserSelect,
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  return res.status(200).json({ user });
}
