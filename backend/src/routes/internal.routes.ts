import { Router, type Request } from "express";

import { env } from "../lib/env";
import { HttpError } from "../lib/http-error";
import { releaseExpiredOrders } from "../lib/reservations";

/**
 * Scheduler-facing routes. Not part of the public API and not used by the
 * storefront — these exist because a serverless deployment has no process to
 * hold a timer, so the schedule lives outside and calls in.
 */
export const internalRouter = Router();

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. With no secret set
 * this refuses to run rather than exposing a public endpoint that mutates
 * orders — a 503 is a configuration mistake worth seeing, an open endpoint is
 * not.
 */
function requireCronSecret(req: Request): void {
  if (!env.CRON_SECRET) {
    throw new HttpError(503, "CRON_SECRET is not set, so scheduled jobs are disabled.");
  }

  const header = req.get("authorization") ?? "";
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    throw new HttpError(401, "Unauthorized");
  }
}

/** GET /internal/sweep — releases stock held by unpaid, expired orders. */
internalRouter.get("/sweep", async (req, res) => {
  requireCronSecret(req);

  const { released, cutoff } = await releaseExpiredOrders();
  console.log(`Cron sweep released ${released} order(s) older than ${cutoff.toISOString()}`);

  return res.status(200).json({ released, cutoff });
});
