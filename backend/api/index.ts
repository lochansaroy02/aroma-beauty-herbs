import type { IncomingMessage, ServerResponse } from "node:http";

import { createApp } from "../src/app";
import { sweepQuietly } from "../src/lib/reservations";
import { loadActiveDisk } from "../src/lib/storage";

/**
 * Vercel entry point.
 *
 * `index.ts` (the VPS entry) owns a port, a sweep timer and signal handlers.
 * None of those exist here: Vercel gives the function a request and takes the
 * instance away again, so this file is the same app with the process-shaped
 * parts removed.
 */

const app = createApp();

/**
 * The one piece of boot work that cannot be skipped.
 *
 * `getActiveDisk()` starts at the MEDIA_DRIVER value and is only corrected once
 * `loadActiveDisk` has read the stored override. Skip it and every upload on a
 * cold instance goes to whatever .env said — on Vercel that means writing to a
 * read-only filesystem and losing the file. Memoised, so it costs one query per
 * instance and nothing thereafter.
 */
let ready: Promise<void> | null = null;

function whenReady(): Promise<void> {
  // loadActiveDisk swallows its own errors and falls back to MEDIA_DRIVER, so
  // this never rejects and never needs re-trying.
  ready ??= loadActiveDisk();
  return ready;
}

/**
 * Expired reservations, swept from the request path.
 *
 * There is no long-lived process to hold a timer, and Vercel Cron on the Hobby
 * plan only fires daily — too coarse for a 30-minute hold. Traffic is the more
 * reliable clock: any request may trigger a sweep, at most once per instance
 * per interval. It is fire-and-forget and compare-and-set throughout, so being
 * killed halfway through leaves nothing half-done, and overlapping with the
 * cron or the CLI is safe.
 */
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = 0;

function maybeSweep(): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  void sweepQuietly();
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await whenReady();
  maybeSweep();
  app(req as never, res as never);
}
