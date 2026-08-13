import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "./env";

/**
 * Local media storage.
 *
 * Files live under MEDIA_ROOT and are served back at `${MEDIA_BASE_URL}/media`,
 * so a file stored at `<root>/videos/facial.mp4` is fetched from
 * `http://host:port/media/videos/facial.mp4`. The database stores only the
 * relative path (`/videos/facial.mp4`), which means moving the disk or putting
 * a real domain in front is a change to MEDIA_BASE_URL and nothing else.
 */

/** Where uploads are filed, mirrored in the URL. */
export const PRODUCT_FOLDER = "/products";
export const VIDEO_FOLDER = "/videos";

/** The URL prefix the static handler is mounted on. */
export const MEDIA_URL_PREFIX = "/media";

/** Folders a caller may write into — anything else is rejected outright. */
const ALLOWED_FOLDERS = new Set([PRODUCT_FOLDER, VIDEO_FOLDER]);

/**
 * Only these ever reach disk. The browser's declared MIME type is not evidence
 * of anything, so the extension is derived from this map rather than from the
 * uploaded filename — that is what stops `payload.php` being written as-is.
 */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export function isAllowedMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXTENSIONS, mime);
}

export const ALLOWED_MIME_TYPES = Object.keys(EXTENSIONS);

/** Absolute path of the media directory. Relative values resolve from cwd. */
export const MEDIA_ROOT = path.resolve(env.MEDIA_ROOT);

/** Public URL for a stored path, e.g. "/videos/facial.mp4". */
export function mediaUrl(filePath: string): string {
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
 * A filesystem-safe stem from the uploaded name, kept only so files stay
 * recognisable when someone lists the directory over SSH. Uniqueness comes from
 * the random suffix, never from this.
 */
function slugifyName(original: string): string {
  const stem = path
    .basename(original, path.extname(original))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return stem || "file";
}

export type StoredFile = {
  /** Relative path, which doubles as the id used to delete it later. */
  file_path: string;
  name: string;
  size: number;
  mime_type: string;
};

/**
 * Writes one uploaded buffer into `folder` and returns its descriptor.
 *
 * The name always gets a random suffix: "front.jpg" collides constantly across
 * products, and silently overwriting someone else's image would be far worse
 * than an ugly filename.
 */
export async function saveUpload(input: {
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
    name: input.originalName,
    size: input.buffer.byteLength,
    mime_type: input.mimeType,
  };
}

/**
 * Best-effort cleanup, by relative path.
 *
 * Called when the database write that would have given these files meaning
 * failed, so a failure here must not mask the original error — an orphaned file
 * on disk is the lesser problem.
 */
export async function deleteMediaFiles(filePaths: string[]): Promise<void> {
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
    console.log(`Media root ready at ${MEDIA_ROOT} (served from ${mediaUrl("")})`);
  } catch (error) {
    console.error(`Could not create the media root at ${MEDIA_ROOT}:`, error);
  }
}
