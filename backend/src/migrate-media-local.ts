/**
 * Pulls media that still lives on ImageKit down onto local disk.
 *
 *   npm run media:migrate -- https://ik.imagekit.io/your_id
 *
 * Existing rows already store the path (`/products/foo_abc.jpg`), and local
 * storage uses the same convention, so the files are fetched from the old
 * endpoint and written at the same relative path. Nothing about `file_name`
 * changes — only `disk`, and `file_id` in custom_properties, which for local
 * files is the path itself.
 *
 * Idempotent: a file already on disk is left alone, so re-running after a
 * partial failure only fetches what's still missing. Run it BEFORE pointing
 * anyone at the new setup — until it completes, existing images 404.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "./lib/prisma";
import { LOCAL_DISK } from "./lib/media";
import { MEDIA_ROOT, resolveMediaPath } from "./lib/storage";

const endpoint = (process.argv[2] ?? process.env["IMAGEKIT_URL_ENDPOINT"] ?? "").replace(
  /\/+$/,
  ""
);

async function exists(absolute: string): Promise<boolean> {
  try {
    await stat(absolute);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!endpoint) {
    console.error(
      "Pass the old ImageKit endpoint, e.g.\n" +
        "  npm run media:migrate -- https://ik.imagekit.io/d7ek3uosg"
    );
    process.exit(1);
  }

  const rows = await prisma.media.findMany({
    where: { disk: { not: LOCAL_DISK } },
    select: { id: true, file_name: true, disk: true, custom_properties: true },
    orderBy: { id: "asc" },
  });

  if (!rows.length) {
    console.log("Nothing to migrate — every media row is already on the local disk.");
    return;
  }

  console.log(`${rows.length} row(s) to migrate from ${endpoint}`);
  console.log(`Writing into ${MEDIA_ROOT}\n`);

  let fetched = 0;
  let skipped = 0;
  const failed: { id: number; file_name: string; reason: string }[] = [];

  for (const row of rows) {
    const relative = row.file_name.startsWith("/") ? row.file_name : `/${row.file_name}`;
    const absolute = resolveMediaPath(relative);

    if (!absolute) {
      failed.push({ id: row.id, file_name: row.file_name, reason: "path escapes media root" });
      continue;
    }

    if (await exists(absolute)) {
      skipped++;
    } else {
      const url = `${endpoint}${relative}`;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          failed.push({
            id: row.id,
            file_name: row.file_name,
            reason: `HTTP ${response.status}`,
          });
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        await mkdir(path.dirname(absolute), { recursive: true });
        await writeFile(absolute, buffer);

        console.log(`  ✓ ${relative} (${Math.round(buffer.byteLength / 1024)}KB)`);
        fetched++;
      } catch (error) {
        failed.push({
          id: row.id,
          file_name: row.file_name,
          reason: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    // Only flip the row once its bytes are definitely on disk.
    const properties = (row.custom_properties ?? {}) as Record<string, unknown>;

    await prisma.media.update({
      where: { id: row.id },
      data: {
        disk: LOCAL_DISK,
        custom_properties: {
          ...properties,
          // For local storage the path is the identity, so deletes key on it.
          file_id: relative,
          // ImageKit generated these; they point at an endpoint we no longer use.
          thumbnail_url: undefined,
        } as never,
      },
    });
  }

  console.log(
    `\nDone. ${fetched} downloaded, ${skipped} already present, ${failed.length} failed.`
  );

  if (failed.length) {
    console.error("\nStill on the old disk — re-upload these from the admin:");
    for (const item of failed) {
      console.error(`  id=${item.id} ${item.file_name} — ${item.reason}`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
