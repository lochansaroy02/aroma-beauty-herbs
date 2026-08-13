import { createApp } from "./app";
import { env } from "./lib/env";
import { verifyMailer } from "./lib/mailer";
import { prisma, verifyDatabase } from "./lib/prisma";
import { RESERVATION_MINUTES, sweepQuietly } from "./lib/reservations";
import { ensureMediaRoot } from "./lib/storage";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

// Surface a bad database or SMTP setup at boot rather than on the first request.
void verifyDatabase();

// Create the media directory now, so the first upload isn't what discovers it
// is missing or unwritable.
void ensureMediaRoot();

void verifyMailer().catch((error: unknown) => {
  console.error("SMTP verification failed — OTP emails will not send:", error);
});

/**
 * Abandoned checkouts hold stock until something gives it back. Every
 * transition is a compare-and-set, so running this alongside other instances
 * (or the CLI) is safe. Move it to cron and delete these lines if you'd rather
 * the web process stayed a web process.
 */
const SWEEP_INTERVAL_MS = 5 * 60_000;

console.log(
  `Releasing unpaid reservations older than ${RESERVATION_MINUTES} minutes, every 5 minutes`
);

void sweepQuietly();
const sweepTimer = setInterval(() => void sweepQuietly(), SWEEP_INTERVAL_MS);
// Don't hold the process open on the timer alone.
sweepTimer.unref();

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);
  clearInterval(sweepTimer);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}


process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
