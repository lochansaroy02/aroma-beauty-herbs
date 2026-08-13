import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "./env";

export type AuthTokenPayload = {
  userId: number;
  email: string;
  role: string;
};

const expiresIn = env.JWT_EXPIRES_IN as SignOptions["expiresIn"];

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  // `verify` widens to string | JwtPayload; a token we signed is always an object.
  if (typeof decoded === "string") {
    throw new Error("Malformed auth token");
  }

  return {
    userId: Number(decoded["userId"]),
    email: String(decoded["email"]),
    role: String(decoded["role"]),
  };
}
