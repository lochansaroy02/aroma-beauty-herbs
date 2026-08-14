import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

/**
 * `schema` is set explicitly rather than left to the connection's search_path.
 *
 * Neon's pooled endpoint hands back an empty search_path, which makes every
 * unqualified table name unresolvable — Prisma reports it as "the underlying
 * table for model X does not exist" even though the table is right there in
 * `public`. Naming the schema here sidesteps the connection's own setting, and
 * is correct on any host.
 */
const adapter = new PrismaPg(
  { connectionString: env.DATABASE_URL },
  { schema: env.DATABASE_SCHEMA }
);

/**
 * Transaction timeouts, raised well above Prisma's defaults.
 *
 * `maxWait` is how long `$transaction` will wait to *start*, and it defaults to
 * 2 seconds. Opening a fresh connection to Neon costs a TLS handshake, and on a
 * plan that auto-suspends when idle it also costs waking the compute — both
 * comfortably past 2s. The result was P2028 "Unable to start a transaction in
 * the given time" on the first few writes after any quiet period, then success
 * once the pool was warm. Every write path in this app runs in a transaction,
 * so that surfaced as a 500 on placing an order, saving an address, uploading a
 * video — anything, but only sometimes, which is the worst way to find a bug.
 *
 * `timeout` is the separate budget for the work inside the callback.
 */
export const prisma = new PrismaClient({
  adapter,
  transactionOptions: { maxWait: 15_000, timeout: 20_000 },
});

/** Host and database from the URL, with credentials left out of logs. */
function describeTarget(): string {
  try {
    const url = new URL(env.DATABASE_URL);
    return `${url.hostname}:${url.port || 5432}${url.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

/**
 * Confirms the database is reachable and migrated at boot. Without this the
 * server starts happily and every data-backed route returns an opaque 500.
 */
export async function verifyDatabase(): Promise<void> {
  const target = describeTarget();

  try {
    await prisma.$queryRaw`select 1`;
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code === "ECONNREFUSED") {
      console.error(
        `Database refused the connection at ${target}. Is Postgres running? ` +
          "Start it, or point DATABASE_URL at a database that is."
      );
      return;
    }

    console.error(`Database unreachable at ${target}:`, (error as Error).message);
    return;
  }

  // Reachable, but the schema may never have been migrated.
  try {
    await prisma.user.count();
    console.log(`Database ready (${target})`);
  } catch {
    console.error(
      `Connected to ${target}, but the "users" table is missing. ` +
        "Run: npx prisma migrate dev"
    );
  }
}
