import ImageKit from "imagekit";

import { env, isImageKitConfigured } from "./env";
import { HttpError } from "./http-error";
import {
  ALLOWED_FOLDERS,
  EXTENSIONS,
  IMAGEKIT_DISK,
  slugifyName,
  type StoredFile,
} from "./storage-shared";

/**
 * The ImageKit driver.
 *
 * Bytes go to ImageKit; the database keeps their `filePath` and, in
 * custom_properties, their `fileId` — which is what deletes are keyed on, since
 * ImageKit's own id is not derivable from the path.
 *
 * Uploads pass through this server rather than going browser-to-ImageKit as
 * they used to. That costs a hop but means the private key never has to be
 * traded for a client-side signature, and both drivers share one upload
 * endpoint, one validation path, and one set of rules about what may be stored.
 *
 * Selected with MEDIA_DRIVER=imagekit. Dispatched from `storage.ts`.
 */

/**
 * Constructed even when unconfigured — the SDK tolerates empty keys, and every
 * entry point calls `requireImageKit()` first, so a misconfigured server fails
 * with a clear 503 rather than at import time.
 */
export const imagekit = new ImageKit({
  publicKey: env.IMAGEKIT_PUBLIC_KEY,
  privateKey: env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/placeholder",
});

export function requireImageKit() {
  if (!isImageKitConfigured) {
    throw new HttpError(
      503,
      "MEDIA_DRIVER is imagekit but it isn't configured. Set IMAGEKIT_PUBLIC_KEY, " +
        "IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT in backend/.env, or set " +
        "MEDIA_DRIVER=local."
    );
  }
}

/** Absolute URL for a stored path, e.g. "/products/rose_abc.jpg". */
export function imageKitUrl(filePath: string): string {
  const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `${env.IMAGEKIT_URL_ENDPOINT}${path}`;
}

export async function saveImageKitUpload(input: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}): Promise<StoredFile> {
  requireImageKit();

  if (!ALLOWED_FOLDERS.has(input.folder)) {
    throw new Error(`Refusing to write outside the known media folders: ${input.folder}`);
  }

  const extension = EXTENSIONS[input.mimeType];
  if (!extension) {
    throw new Error(`Unsupported media type: ${input.mimeType}`);
  }

  // Same naming rule as the local driver: the extension comes from the verified
  // MIME type, never from whatever the uploader called the file.
  const fileName = `${slugifyName(input.originalName)}${extension}`;

  const result = await imagekit.upload({
    file: input.buffer,
    fileName,
    folder: input.folder,
    // Names collide constantly ("front.jpg"); let ImageKit suffix them rather
    // than overwrite somebody else's image.
    useUniqueFileName: true,
  });

  if (!result?.fileId || !result.filePath) {
    throw new Error("ImageKit accepted the upload but returned no file reference");
  }

  return {
    file_path: result.filePath,
    file_id: result.fileId,
    name: input.originalName,
    size: result.size ?? input.buffer.byteLength,
    // ImageKit reports fileType ("image"), not a MIME type — ours is accurate.
    mime_type: input.mimeType,
    disk: IMAGEKIT_DISK,
    ...(result.width ? { width: result.width } : {}),
    ...(result.height ? { height: result.height } : {}),
    ...(result.thumbnailUrl ? { thumbnail_url: result.thumbnailUrl } : {}),
  };
}

/**
 * Best-effort cleanup by ImageKit fileId.
 *
 * Called when the database write that would have given these files meaning
 * failed, so a failure here must not mask the original error — an orphan in the
 * media library is the lesser problem.
 */
export async function deleteImageKitFiles(fileIds: string[]): Promise<void> {
  const ids = fileIds.filter(Boolean);
  if (!ids.length || !isImageKitConfigured) return;

  try {
    await imagekit.bulkDeleteFiles(ids);
  } catch (error) {
    console.error("Failed to remove orphaned ImageKit files:", ids, error);
  }
}
