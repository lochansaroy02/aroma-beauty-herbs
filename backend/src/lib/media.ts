import { randomUUID } from "node:crypto";

import { Prisma } from "../generated/prisma/client";
import { getActiveDisk, mediaUrlFor } from "./storage";
import type { FileRef, StoredFile } from "./storage-shared";

/**
 * Matches how Laravel/Spatie writes the polymorphic key, so rows created here
 * sit alongside anything imported from the old app. Change this one constant if
 * you standardise on a different value.
 */
export const PRODUCT_MODEL_TYPE = "App\\Models\\Product";
export const VIDEO_SECTION_MODEL_TYPE = "App\\Models\\HomeVideoSection";

/** One hero image per product, plus any number of gallery shots. */
export const MAIN_IMAGE_COLLECTION = "main";
export const GALLERY_COLLECTION = "gallery";
/** The single video file attached to a video section. */
export const VIDEO_COLLECTION = "video";

/** `disk` records where the bytes actually live, per row. */
export { IMAGEKIT_DISK, LOCAL_DISK } from "./storage-shared";

/** Spatie requires these Json columns; empty objects are its own defaults. */
export const EMPTY_MEDIA_JSON = {
  manipulations: {},
  custom_properties: {},
  generated_conversions: {},
  responsive_images: {},
} as const;

export type MediaRow = {
  id: number;
  file_name: string;
  name: string;
  mime_type: string | null;
  size: number;
  order_column: number | null;
  collection_name: string;
  /** Which storage holds the bytes. Drives both the URL and the delete. */
  disk: string;
  custom_properties: Prisma.JsonValue;
};

/**
 * The descriptor returned by POST /uploads and posted back with the form that
 * gives the file meaning. Covers both images and videos — they are stored the
 * same way and only the accepted MIME types differ, which the request schemas
 * enforce. `file_id` is the stored path: for a local file the path is the id.
 */
export type UploadedFile = {
  file_id: string;
  file_path: string;
  name: string;
  size: number;
  /** Set by the upload endpoint; absent means "whatever is active now". */
  disk?: string | undefined;
  mime_type?: string | undefined;
  thumbnail_url?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  /** Videos only, in seconds. */
  duration?: number | undefined;
  alt?: string | undefined;
};

/** @deprecated Kept for readability at image-only call sites. */
export type UploadedImage = UploadedFile;

type CustomProperties = {
  alt?: unknown;
  file_id?: unknown;
  thumbnail_url?: unknown;
  width?: unknown;
  height?: unknown;
  duration?: unknown;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Turns a stored media row into the shape the API returns. `file_name` holds the
 * path relative to the media root, so the URL is always rebuilt from the current
 * MEDIA_BASE_URL rather than pinned to whatever it was on the day of upload.
 */
export function toMediaPayload(media: MediaRow) {
  const properties = (media.custom_properties ?? {}) as CustomProperties;

  return {
    id: media.id,
    // Resolved against this row's disk, not the active driver.
    url: mediaUrlFor(media.disk, media.file_name),
    path: media.file_name,
    file_id: str(properties.file_id),
    thumbnail_url: str(properties.thumbnail_url),
    width: num(properties.width),
    height: num(properties.height),
    name: media.name,
    mime_type: media.mime_type,
    size: media.size,
    duration: num(properties.duration),
    alt: str(properties.alt),
    position: media.order_column ?? 0,
  };
}

/** Non-null values only — Prisma's Json columns reject `undefined` members. */
export function customPropertiesFor(file: UploadedFile): Prisma.InputJsonValue {
  return {
    file_id: file.file_id,
    ...(file.alt ? { alt: file.alt } : {}),
    ...(file.thumbnail_url ? { thumbnail_url: file.thumbnail_url } : {}),
    ...(file.width ? { width: file.width } : {}),
    ...(file.height ? { height: file.height } : {}),
    ...(file.duration ? { duration: file.duration } : {}),
  };
}

export const mediaSelect = {
  id: true,
  file_name: true,
  name: true,
  mime_type: true,
  size: true,
  order_column: true,
  collection_name: true,
  disk: true,
  custom_properties: true,
} satisfies Prisma.MediaSelect;

/**
 * Writes media rows for files already written to disk by POST /uploads.
 *
 * `order_column` continues from `startAt`, so attaching more files later
 * appends rather than reshuffles. Shared by product images and video sections —
 * the only difference between them is the model type and collection.
 */
export async function createMediaRows(
  tx: Prisma.TransactionClient,
  input: {
    modelType: string;
    modelId: number;
    collection: string;
    files: UploadedFile[];
    startAt?: number;
  }
): Promise<MediaRow[]> {
  const now = new Date();
  const startAt = input.startAt ?? 0;
  const rows: MediaRow[] = [];

  for (const [index, file] of input.files.entries()) {
    const row = await tx.media.create({
      data: {
        model_type: input.modelType,
        model_id: input.modelId,
        uuid: randomUUID(),
        collection_name: input.collection,
        name: file.name,
        // Path only — the URL is rebuilt from MEDIA_BASE_URL on read.
        file_name: file.file_path,
        mime_type: file.mime_type ?? null,
        // The disk this file was actually written to, so a later driver
        // switch never changes where this row is read from.
        disk: file.disk ?? getActiveDisk(),
        size: file.size,
        order_column: startAt + index + 1,
        created_at: now,
        updated_at: now,
        ...EMPTY_MEDIA_JSON,
        custom_properties: customPropertiesFor(file),
      },
      select: mediaSelect,
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Delete references for media rows.
 *
 * Returns the disk alongside the id: a library that has been through a driver
 * switch holds rows on both, and deleting an ImageKit file by unlinking a local
 * path (or the reverse) silently does nothing.
 */
export function fileIdsOf(
  rows: Pick<MediaRow, "custom_properties" | "disk">[]
): FileRef[] {
  return rows
    .map((row) => ({
      disk: row.disk,
      file_id: str(((row.custom_properties ?? {}) as CustomProperties).file_id),
    }))
    .filter((ref): ref is FileRef => ref.file_id !== null);
}
