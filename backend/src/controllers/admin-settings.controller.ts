import type { Request, Response } from "express";
import { z } from "zod";

import { env, isImageKitConfigured } from "../lib/env";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import {
  IMAGEKIT_DISK,
  LOCAL_DISK,
  MEDIA_ROOT,
  driverSource,
  getActiveDisk,
  setActiveDisk,
} from "../lib/storage";

/** Runtime switches an admin can change without a redeploy. */

const driverSchema = z.object({
  driver: z.enum([LOCAL_DISK, IMAGEKIT_DISK]),
});

/** GET /admin/settings/media */
export async function getMediaSettings(_req: Request, res: Response) {
  // Counting per disk is what makes the switch legible: it shows the admin that
  // existing files stay where they are rather than moving with the setting.
  const grouped = await prisma.media.groupBy({
    by: ["disk"],
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const row of grouped) counts[row.disk] = row._count._all;

  return res.status(200).json({
    driver: getActiveDisk(),
    source: driverSource(),
    counts,
    local: { root: MEDIA_ROOT, base_url: env.MEDIA_BASE_URL },
    imagekit: {
      configured: isImageKitConfigured,
      // The endpoint is public in every image URL already; the keys are not,
      // and are never returned.
      endpoint: env.IMAGEKIT_URL_ENDPOINT || null,
    },
  });
}

/** PATCH /admin/settings/media */
export async function updateMediaSettings(req: Request, res: Response) {
  const parsed = driverSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  // Throws a 422 when ImageKit is picked without its keys, rather than leaving a
  // setting that looks applied and 503s on the next upload.
  await setActiveDisk(parsed.data.driver, req.auth?.userId ?? null);

  return res.status(200).json({ driver: getActiveDisk(), source: driverSource() });
}
