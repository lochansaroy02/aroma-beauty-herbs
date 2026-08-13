/** Our own proxy route, which forwards to the API with the session token. */
const UPLOAD_ENDPOINT = "/api/media/upload";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_GALLERY_IMAGES = 10;
/** Matches MAX_UPLOAD_BYTES in the API; the smaller of the two always wins. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

/** Formats a browser can play back natively without a transcoding step. */
export const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(",");
export const ACCEPT_VIDEO_ATTRIBUTE = ACCEPTED_VIDEO_TYPES.join(",");

/** Which family of file an upload slot takes. */
export type UploadKind = "image" | "video";

/**
 * What the API returns for a stored file. `file_id` is the path on disk — for
 * local storage the path is the identity, and it's what a later discard or
 * delete is keyed on.
 */
export type UploadedImage = {
  file_id: string;
  file_path: string;
  name: string;
  size: number;
  mime_type?: string;
  /** Kept optional so existing rows that carry them still typecheck. */
  thumbnail_url?: string;
  width?: number;
  height?: number;
  /** Videos only, in seconds. */
  duration?: number;
};

/** Same payload either way — the name just reads better at video call sites. */
export type UploadedVideo = UploadedImage;

export class UploadError extends Error {}

function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

/** Checked here so an oversized file never leaves the browser. */
export function validateImage(file: File): string | null {
  return validateUpload(file, "image");
}

export function validateUpload(file: File, kind: UploadKind = "image"): string | null {
  const allowed: readonly string[] =
    kind === "video" ? ACCEPTED_VIDEO_TYPES : ACCEPTED_TYPES;
  const limit = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

  if (!allowed.includes(file.type)) {
    return kind === "video"
      ? `${file.name}: only MP4, WebM and MOV videos are allowed.`
      : `${file.name}: only JPEG, PNG, WebP, AVIF and GIF images are allowed.`;
  }

  if (file.size > limit) {
    return `${file.name}: ${kind}s must be ${megabytes(limit)}MB or smaller.`;
  }

  return null;
}

type UploadResponse = {
  file_id?: string;
  file_path?: string;
  name?: string;
  size?: number;
  mime_type?: string;
  error?: string;
};

/**
 * Sends one file to our own API, which writes it to disk and returns where it
 * put it. The validation above is a courtesy to the user; the API re-checks
 * type and size regardless, since nothing the browser says is evidence.
 */
export async function uploadMedia(
  file: File,
  kind: UploadKind = "image"
): Promise<UploadedImage> {
  const invalid = validateUpload(file, kind);
  if (invalid) throw new UploadError(invalid);

  const form = new FormData();
  form.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${UPLOAD_ENDPOINT}?kind=${kind}`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new UploadError(`${file.name}: upload failed. Check your connection.`);
  }

  const payload = (await response.json().catch(() => null)) as UploadResponse | null;

  if (!response.ok || !payload?.file_path) {
    throw new UploadError(payload?.error ?? `${file.name}: the upload was rejected.`);
  }

  return {
    file_id: payload.file_id ?? payload.file_path,
    file_path: payload.file_path,
    name: payload.name ?? file.name,
    size: payload.size ?? file.size,
    mime_type: payload.mime_type ?? file.type,
  };
}
