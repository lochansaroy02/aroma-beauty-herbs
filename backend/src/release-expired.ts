/**
 * Releases stock held by unpaid orders past the reservation window.
 *
 *   npm run orders:sweep          # uses ORDER_RESERVATION_MINUTES (default 30)
 *   npm run orders:sweep -- 0     # release every pending order, now
 *
 * The API runs this on a timer too; this exists for one-off cleanups and for
 * running it from cron if you'd rather the web process didn't.
 */
import { prisma } from "./lib/prisma";
import { RESERVATION_MINUTES, releaseExpiredOrders } from "./lib/reservations";

async function main() {
  const argument = process.argv[2];
  const minutes =
    argument === undefined ? RESERVATION_MINUTES : Number(argument);

  if (!Number.isFinite(minutes) || minutes < 0) {
    console.error(`Not a valid number of minutes: ${argument}`);
    process.exitCode = 1;
    return;
  }

  const { released, cutoff } = await releaseExpiredOrders(minutes);

  console.log(
    released === 0
      ? `Nothing to release — no unpaid orders older than ${minutes} minute(s).`
      : `Released stock from ${released} order(s) placed before ${cutoff.toISOString()}.`
  );
}

main()
  .catch((error: unknown) => {
    console.error("Sweep failed:", error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
