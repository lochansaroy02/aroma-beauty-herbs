import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";

import { HttpError } from "../lib/http-error";
import { MAX_UPLOAD_BYTES } from "../routes/media.routes";

/** Final Express error handler. Must keep all four args to be recognised. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  // Multer rejects before the controller runs, so its failures would otherwise
  // surface as a bare 500 with no hint about what the admin did wrong.
  if (error instanceof MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? `File is too large. The limit is ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`
        : `Upload rejected: ${error.message}`;

    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: message });
  }

  /**
   * http-errors-shaped failures, which is how express.static reports a missing
   * file when `fallthrough` is off. Without this a broken <img> would answer
   * 500 and log itself as an unhandled bug on every page view. Only the status
   * is trusted — the message could name a filesystem path.
   */
  const status = (error as { status?: unknown; statusCode?: unknown } | null)?.status ??
    (error as { statusCode?: unknown } | null)?.statusCode;

  if (typeof status === "number" && status >= 400 && status < 500) {
    return res
      .status(status)
      .json({ error: status === 404 ? "Not found" : "Request rejected" });
  }

  // Anything unrecognised is a bug — log it, but don't leak internals.
  console.error("Unhandled error:", error);
  return res.status(500).json({ error: "Internal server error" });
}

export function notFound(_req: Request, res: Response) {
  return res.status(404).json({ error: "Route not found" });
}
