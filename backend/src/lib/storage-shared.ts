/**
 * Things both storage drivers agree on.
 *
 * Kept apart from `storage.ts` so the drivers can import them without importing
 * the dispatcher that imports the drivers.
 */

/** Where uploads are filed. Mirrored in the URL on both disks. */
export const PRODUCT_FOLDER = "/products";
export const VIDEO_FOLDER = "/videos";

/** The URL prefix the local static handler is mounted on. */
export const MEDIA_URL_PREFIX = "/media";

/** Folders a caller may write into — anything else is rejected outright. */
export const ALLOWED_FOLDERS = new Set([PRODUCT_FOLDER, VIDEO_FOLDER]);

/**
 * The only types that are ever stored. The browser's declared MIME type is not
 * evidence of anything, so the extension is derived from this map rather than
 * from the uploaded filename — that is what stops `payload.php` being written
 * under its own name.
 */
export const EXTENSIONS: Record<string, string> = {
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

/** Which storage a file's bytes live on. Recorded per media row. */
export const LOCAL_DISK = "local";
export const IMAGEKIT_DISK = "imagekit";

export type StorageDisk = typeof LOCAL_DISK | typeof IMAGEKIT_DISK;

export type StoredFile = {
  /** Path within the disk, e.g. "/products/rose-a1b2c3.jpg". */
  file_path: string;
  /**
   * How the file is addressed for deletion. On local storage the path is the
   * identity; on ImageKit it's their opaque fileId, which the path can't
   * substitute for.
   */
  file_id: string;
  name: string;
  size: number;
  mime_type: string;
  disk: StorageDisk;
  width?: number | undefined;
  height?: number | undefined;
  thumbnail_url?: string | undefined;
};

/** A stored file identified well enough to delete it, whichever disk it's on. */
export type FileRef = { disk: string; file_id: string };

/**
 * A filesystem-safe stem from the uploaded name, kept only so files stay
 * recognisable when someone lists them. Uniqueness comes from the random
 * suffix, never from this.
 */
export function slugifyName(original: string): string {
  const stem = original
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return stem || "file";
}
