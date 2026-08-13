import { Router } from "express";
import multer from "multer";

import { discardMedia, uploadMedia } from "../controllers/media.controller";
import { HttpError } from "../lib/http-error";
import { requireAdmin } from "../middleware/require-admin";
import { requireAuth } from "../middleware/require-auth";
import { ALLOWED_MIME_TYPES } from "../lib/storage";

/** The API's ceiling. Videos are the reason it isn't smaller. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Memory storage, not multer's disk storage: files are only written once the
 * type checks in the controller have passed, and always through saveUpload, so
 * there is exactly one place that decides what a file is called and where it
 * lands. The size limit below is what keeps that buffer bounded.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new HttpError(415, `Unsupported file type: ${file.mimetype || "unknown"}`));
      return;
    }
    callback(null, true);
  },
});

/**
 * Mounted at /uploads, deliberately not at /media: that path is owned by the
 * static file handler, and serve-static answers a POST there with 405 before
 * any router sees it.
 */
export const mediaRouter = Router();

// Guarded: writing into the media library is a staff action.
mediaRouter.post("/", requireAuth, requireAdmin, upload.single("file"), uploadMedia);
mediaRouter.post("/discard", requireAuth, requireAdmin, discardMedia);
