import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error";
import { signAuthToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { loginSchema } from "../schemas/auth.schema";

const SALT_ROUNDS = 12;

const ACTIVE_STATUS = "1";

/**
 * Sign-in only — there is no public registration.
 *
 * This site is a landing page: it has no customer accounts to create, and the
 * only people who log in are staff editing the homepage. Accounts are made from
 * the server with `npm run make:admin` and `npm run set:password`, which is why
 * the signup and OTP endpoints are gone rather than merely hidden.
 */

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

  if (user.status !== ACTIVE_STATUS) {
    throw new HttpError(403, "This account is not active. Please contact support.");
  }

  /**
   * Staff only. A Customer row left over from when this was a shop can still
   * authenticate against the database, so the gate is here as well as on the
   * admin routes — otherwise an old account would get a valid session and a
   * confusing empty dashboard rather than a clear refusal.
   */
  if (user.role_as !== "Admin") {
    throw new HttpError(403, "This account doesn't have access to the admin panel.");
  }

  const token = signAuthToken({
    userId: user.id,
    email: user.email,
    role: user.role_as,
  });

  return res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role_as: user.role_as,
      status: user.status,
      created_at: user.created_at,
    },
    token,
  });
}

/** GET /auth/me — who the bearer token belongs to. */
export async function me(req: Request, res: Response) {
  if (!req.auth) throw new HttpError(401, "Authentication required");

  const user = await prisma.user.findFirst({
    where: { id: req.auth.userId, deleted_at: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role_as: true,
      status: true,
      created_at: true,
    },
  });

  if (!user) throw new HttpError(401, "Account no longer exists");

  return res.status(200).json({ user });
}
