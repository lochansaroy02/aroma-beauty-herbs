import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error";
import {
  PRODUCT_FOLDER,
  VIDEO_FOLDER,
  deleteMediaFiles,
  isAllowedMime,
  requireStorage,
  saveUpload,
} from "../lib/storage";

/**
 * Uploads now land on this server instead of a third party, but the contract
 * with the client is unchanged: post a file, get back a descriptor, then send
 * that descriptor along with the form that gives it meaning. `file_id` is the
 * stored path — for local files the path *is* the identity.
 */

const KIND_FOLDERS = {
  image: PRODUCT_FOLDER,
  video: VIDEO_FOLDER,
} as const;

type Kind = keyof typeof KIND_FOLDERS;

const uploadQuerySchema = z.object({
  kind: z.enum(["image", "video"]).default("image"),
});

/** POST /media/upload — admin only. Multipart, single field named "file". */
export async function uploadMedia(req: Request, res: Response) {
  const parsed = uploadQuerySchema.safeParse(req.query ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  // Fails with a clear 503 when the active driver isn't configured, rather
  // than accepting the bytes and losing them.
  requireStorage();

  const kind: Kind = parsed.data.kind;
  const file = req.file;

  if (!file) {
    throw new HttpError(422, "No file was uploaded", { file: ["A file is required"] });
  }

  const mime = file.mimetype;

  if (!isAllowedMime(mime)) {
    throw new HttpError(415, `Unsupported file type: ${mime || "unknown"}`);
  }

  // A video posted to the image slot would be filed under /products and served
  // as a product image, so the family has to match the slot it was sent to.
  const family = kind === "video" ? "video/" : "image/";
  if (!mime.startsWith(family)) {
    throw new HttpError(415, `Expected ${kind === "video" ? "a video" : "an image"}, got ${mime}`);
  }

  const stored = await saveUpload({
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: mime,
    folder: KIND_FOLDERS[kind],
  });

  return res.status(201).json({
    file_id: stored.file_id,
    file_path: stored.file_path,
    name: stored.name,
    size: stored.size,
    mime_type: stored.mime_type,
    // Echoed back so the row records the disk these bytes actually went to,
    // even if MEDIA_DRIVER changes between this upload and the form's save.
    disk: stored.disk,
    ...(stored.width ? { width: stored.width } : {}),
    ...(stored.height ? { height: stored.height } : {}),
    ...(stored.thumbnail_url ? { thumbnail_url: stored.thumbnail_url } : {}),
  });
}

const discardSchema = z.object({
  file_ids: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
});

/**
 * POST /media/discard — admin only.
 *
 * Uploads happen before the form is saved, so a cancelled dialog or a swapped
 * thumbnail leaves a file nothing points at. Paths are re-validated against the
 * media root inside deleteMediaFiles, so a crafted id can't reach the rest of
 * the filesystem.
 */
export async function discardMedia(req: Request, res: Response) {
  const parsed = discardSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  await deleteMediaFiles(parsed.data.file_ids);

  return res.status(200).json({ discarded: parsed.data.file_ids.length });
}
