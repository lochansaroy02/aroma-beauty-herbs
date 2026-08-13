import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

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
