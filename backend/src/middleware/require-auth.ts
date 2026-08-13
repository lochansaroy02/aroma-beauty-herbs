import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../lib/http-error";
import { verifyAuthToken } from "../lib/jwt";

/** Verifies `Authorization: Bearer <token>` and populates `req.auth`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing Bearer token"));
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    req.auth = verifyAuthToken(token);
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token"));
  }
}
