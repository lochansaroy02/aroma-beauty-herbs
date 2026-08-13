import { createApp } from "./app";
import { env } from "./lib/env";
import { verifyMailer } from "./lib/mailer";
import { prisma, verifyDatabase } from "./lib/prisma";
import { RESERVATION_MINUTES, sweepQuietly } from "./lib/reservations";
import { verifyStorage } from "./lib/storage";

const app = createApp();

let server: ReturnType<typeof app.listen> | undefined;

/**
 * Storage is resolved before the port opens, not alongside it.
 *
 * `getActiveDisk()` answers with the MEDIA_DRIVER value until `verifyStorage`
 * has read the stored override out of the database. Listening first leaves a
 * window — short, but a real one — where an upload is written to whichever disk
 * .env named rather than the one the admin selected, and the file ends up
 * somewhere nothing will look for it again.
 */
async function start(): Promise<void> {
  await verifyStorage();

  server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

// Surface a bad database or SMTP setup at boot rather than on the first request.
// Neither gates the port: a request against a broken database fails loudly on
// its own, and nothing is written to the wrong place while waiting.
void verifyDatabase();

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
  server?.close();
  await prisma.$disconnect();
  process.exit(0);
}


process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start().catch((error: unknown) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
