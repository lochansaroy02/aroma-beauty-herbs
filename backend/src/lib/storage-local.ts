import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "./env";

/**
 * The local-disk driver.
 *
 * Files live under MEDIA_ROOT and are served back at `${MEDIA_BASE_URL}/media`,
 * so a file stored at `<root>/videos/facial.mp4` is fetched from
 * `http://host:port/media/videos/facial.mp4`. The database stores only the
 * relative path (`/videos/facial.mp4`), which means moving the disk or putting
 * a real domain in front is a change to MEDIA_BASE_URL and nothing else.
 *
 * Selected with MEDIA_DRIVER=local. Dispatched from `storage.ts` — import that,
 * not this, so a row on the other disk still resolves correctly.
 */

import {
  ALLOWED_FOLDERS,
  EXTENSIONS,
  LOCAL_DISK,
  MEDIA_URL_PREFIX,
  slugifyName,
  type StoredFile,
} from "./storage-shared";

/** Absolute path of the media directory. Relative values resolve from cwd. */
export const MEDIA_ROOT = path.resolve(env.MEDIA_ROOT);

/** Public URL for a stored path, e.g. "/videos/facial.mp4". */
export function localUrl(filePath: string): string {
  const relative = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `${env.MEDIA_BASE_URL}${MEDIA_URL_PREFIX}${relative}`;
}

/**
 * Absolute path for a stored relative path, or null when it would escape the
 * media root. Every filesystem operation goes through this — a stored value is
 * only ever as trustworthy as the request that created it.
 */
export function resolveMediaPath(filePath: string): string | null {
  const relative = filePath.startsWith("/") ? filePath.slice(1) : filePath;
  const absolute = path.resolve(MEDIA_ROOT, relative);

  // path.resolve collapses "..", so comparing afterwards catches traversal that
  // string inspection of the input would miss.
  if (absolute !== MEDIA_ROOT && !absolute.startsWith(MEDIA_ROOT + path.sep)) {
    return null;
  }

  return absolute;
}

/**
 * Writes one uploaded buffer into `folder` and returns its descriptor.
 *
 * The name always gets a random suffix: "front.jpg" collides constantly across
 * products, and silently overwriting someone else's image would be far worse
 * than an ugly filename.
 */
export async function saveLocalUpload(input: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}): Promise<StoredFile> {
  if (!ALLOWED_FOLDERS.has(input.folder)) {
    throw new Error(`Refusing to write outside the known media folders: ${input.folder}`);
  }

  const extension = EXTENSIONS[input.mimeType];
  if (!extension) {
    throw new Error(`Unsupported media type: ${input.mimeType}`);
  }

  const fileName = `${slugifyName(input.originalName)}-${randomBytes(6).toString("hex")}${extension}`;
  const relative = `${input.folder}/${fileName}`;

  const absolute = resolveMediaPath(relative);
  if (!absolute) throw new Error("Resolved media path escaped the media root");

  await mkdir(path.dirname(absolute), { recursive: true });
  // "wx" so a name collision surfaces as an error rather than silently
  // overwriting a file some other product already points at.
  await writeFile(absolute, input.buffer, { flag: "wx" });

  return {
    file_path: relative,
    // On local storage the path is the identity — there is no separate handle.
    file_id: relative,
    name: input.originalName,
    size: input.buffer.byteLength,
    mime_type: input.mimeType,
    disk: LOCAL_DISK,
  };
}

/**
 * Best-effort cleanup, by relative path.
 *
 * Called when the database write that would have given these files meaning
 * failed, so a failure here must not mask the original error — an orphaned file
 * on disk is the lesser problem.
 */
export async function deleteLocalFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths.filter(Boolean)) {
    const absolute = resolveMediaPath(filePath);

    if (!absolute) {
      console.error("Refusing to delete a path outside the media root:", filePath);
      continue;
    }

    try {
      await unlink(absolute);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Already gone is the outcome we wanted.
      if (code !== "ENOENT") {
        console.error("Failed to remove media file:", filePath, error);
      }
    }
  }
}

/** Creates the media root at boot so the first upload isn't the thing that finds it missing. */
export async function ensureMediaRoot(): Promise<void> {
  try {
    await mkdir(MEDIA_ROOT, { recursive: true });
    console.log(`Media root ready at ${MEDIA_ROOT} (served from ${localUrl("")})`);
  } catch (error) {
    console.error(`Could not create the media root at ${MEDIA_ROOT}:`, error);
  }
}
