import { env, isImageKitConfigured } from "./env";
import { HttpError } from "./http-error";
import { prisma } from "./prisma";
import {
  deleteImageKitFiles,
  imageKitUrl,
  requireImageKit,
  saveImageKitUpload,
} from "./storage-imagekit";
import {
  MEDIA_ROOT,
  deleteLocalFiles,
  ensureMediaRoot,
  localUrl,
  resolveMediaPath,
  saveLocalUpload,
} from "./storage-local";
import {
  IMAGEKIT_DISK,
  LOCAL_DISK,
  MEDIA_URL_PREFIX,
  PRODUCT_FOLDER,
  VIDEO_FOLDER,
  isAllowedMime,
  ALLOWED_MIME_TYPES,
  type FileRef,
  type StorageDisk,
  type StoredFile,
} from "./storage-shared";

/**
 * Storage dispatcher.
 *
 * `MEDIA_DRIVER` decides where NEW uploads go. It deliberately does not decide
 * where existing ones are read from: every media row records the disk it was
 * written to, and `mediaUrlFor` / `deleteMediaFiles` resolve from that. So the
 * switch can be flipped in either direction, or flipped back, and everything
 * already uploaded keeps working exactly where it is — including a library with
 * files on both disks at once.
 */

export {
  MEDIA_ROOT,
  MEDIA_URL_PREFIX,
  PRODUCT_FOLDER,
  VIDEO_FOLDER,
  IMAGEKIT_DISK,
  LOCAL_DISK,
  ALLOWED_MIME_TYPES,
  isAllowedMime,
  ensureMediaRoot,
  resolveMediaPath,
};
export type { FileRef, StorageDisk, StoredFile };

/** The key the override is stored under, when an admin has set one. */
export const MEDIA_DRIVER_SETTING = "media_driver";

function normalise(value: string | null | undefined): StorageDisk {
  return value?.trim().toLowerCase() === IMAGEKIT_DISK ? IMAGEKIT_DISK : LOCAL_DISK;
}

/** The .env value, used until the database says otherwise. */
const envDisk = normalise(env.MEDIA_DRIVER);

/**
 * Which disk new uploads land on.
 *
 * Held in memory rather than read per call: `saveUpload` and `deleteMediaFiles`
 * are synchronous about this decision, and a database round trip inside every
 * delete would be a poor trade for a value that changes about twice a year.
 * `loadActiveDisk` seeds it at boot and `setActiveDisk` updates both copies.
 *
 * One consequence worth knowing: on more than one server process, a toggle only
 * moves the process that served the request. The others pick it up when they
 * next restart. Single-instance deploys — which is what this runs on — are
 * unaffected.
 */
let currentDisk: StorageDisk = envDisk;

export function getActiveDisk(): StorageDisk {
  return currentDisk;
}

export function isImageKitActive(): boolean {
  return currentDisk === IMAGEKIT_DISK;
}

/** Where the current value came from, so the admin screen can say so. */
export function driverSource(): "database" | "env" {
  return currentDisk === envDisk && !overridden ? "env" : "database";
}

let overridden = false;

/** Reads the stored override at boot. Absent means "use the .env default". */
export async function loadActiveDisk(): Promise<void> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: MEDIA_DRIVER_SETTING },
    });

    if (row) {
      currentDisk = normalise(row.value);
      overridden = true;
    }
  } catch (error) {
    // A database that isn't up yet must not stop the server booting — the .env
    // default is a perfectly good answer until someone changes it.
    console.error("Could not read the stored media driver; using MEDIA_DRIVER:", error);
  }
}

/**
 * Switches the driver and persists it.
 *
 * Refuses to select ImageKit while its keys are missing: the alternative is a
 * setting that looks applied and then fails on every upload with a 503.
 */
export async function setActiveDisk(
  disk: StorageDisk,
  updatedBy?: number | null
): Promise<void> {
  if (disk === IMAGEKIT_DISK && !isImageKitConfigured) {
    throw new HttpError(
      422,
      "ImageKit isn't configured. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY " +
        "and IMAGEKIT_URL_ENDPOINT in backend/.env, then restart the API."
    );
  }

  await prisma.appSetting.upsert({
    where: { key: MEDIA_DRIVER_SETTING },
    update: { value: disk, updated_by: updatedBy ?? null },
    create: { key: MEDIA_DRIVER_SETTING, value: disk, updated_by: updatedBy ?? null },
  });

  currentDisk = disk;
  overridden = true;
}

/**
 * Public URL for a stored file, resolved against the disk that holds it.
 *
 * `disk` is the row's own value, not the active driver — a library that has
 * been through a driver switch has rows on both, and each must resolve against
 * the place its bytes actually are.
 */
export function mediaUrlFor(disk: string | null | undefined, filePath: string): string {
  return disk === IMAGEKIT_DISK ? imageKitUrl(filePath) : localUrl(filePath);
}

/** Writes an upload to whichever disk is currently active. */
export function saveUpload(input: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}): Promise<StoredFile> {
  return isImageKitActive() ? saveImageKitUpload(input) : saveLocalUpload(input);
}

/** Fails early with a clear message when the active driver isn't usable. */
export function requireStorage(): void {
  if (isImageKitActive()) requireImageKit();
}

/** Anything that names a stored file well enough to remove it. */
export type Deletable = string | { disk?: string | null | undefined; file_id: string };

/**
 * Best-effort cleanup, routed to the disk each file is actually on.
 *
 * Prefer passing the upload descriptor or the media row, both of which carry
 * `disk`. A bare id is assumed to be on the active disk — true for a file this
 * same request just uploaded, but wrong for anything older, so it is only safe
 * where the id was produced moments earlier.
 */
export async function deleteMediaFiles(files: Deletable[]): Promise<void> {
  const localPaths: string[] = [];
  const imageKitIds: string[] = [];

  for (const entry of files) {
    const ref =
      typeof entry === "string"
        ? { disk: getActiveDisk(), file_id: entry }
        : { disk: entry.disk || getActiveDisk(), file_id: entry.file_id };

    if (!ref.file_id) continue;
    if (ref.disk === IMAGEKIT_DISK) imageKitIds.push(ref.file_id);
    else localPaths.push(ref.file_id);
  }

  if (localPaths.length) await deleteLocalFiles(localPaths);
  if (imageKitIds.length) await deleteImageKitFiles(imageKitIds);
}

/** Reports the storage setup at boot, so a bad driver isn't found by an upload. */
export async function verifyStorage(): Promise<void> {
  // The stored override wins over .env, so it has to be read before reporting.
  await loadActiveDisk();

  if (isImageKitActive()) {
    if (!isImageKitConfigured) {
      console.error(
        "MEDIA_DRIVER=imagekit but IMAGEKIT_PUBLIC_KEY / IMAGEKIT_PRIVATE_KEY / " +
          "IMAGEKIT_URL_ENDPOINT are not all set — uploads will fail with 503."
      );
      return;
    }
    console.log(`Media driver: imagekit (${env.IMAGEKIT_URL_ENDPOINT}) [${driverSource()}]`);
    // The local root is still created: rows written before the switch are
    // served from it, and switching back must not need a restart to work.
    await ensureMediaRoot();
    return;
  }

  console.log(`Media driver: local [${driverSource()}]`);
  await ensureMediaRoot();
}
