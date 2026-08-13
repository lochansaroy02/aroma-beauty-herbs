import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../lib/http-error";

/** Must run after requireAuth, which populates req.auth from the token. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) {
    return next(new HttpError(401, "Authentication required"));
  }

  if (req.auth.role !== "Admin") {
    return next(new HttpError(403, "Admins only"));
  }

  return next();
}
