import { z } from "zod";

/**
 * Videos are large. This is the schema's ceiling; the upload route enforces the
 * same limit on the raw request, whichever is hit first.
 */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/**
 * The descriptor POST /uploads returns for a video, posted back for storage.
 * Mirrors the image version but insists on a video MIME type, so a picture
 * can't be filed as a video.
 */
export const uploadedVideoSchema = z.object({
  // How the file is deleted later: the path on local storage, ImageKit's own
  // fileId on ImageKit. Opaque to us either way.
  file_id: z.string().trim().min(1).max(500),
  /**
   * Which storage the bytes went to. Recorded on the row so a later change of
   * MEDIA_DRIVER never changes where this file is read from or deleted.
   */
  disk: z.enum(["local", "imagekit"]).optional(),
  file_path: z
    .string()
    .trim()
    .min(1)
    .max(500)
    // Rebuilt into a URL against MEDIA_BASE_URL, so it must stay a plain path.
    .refine((value) => !/^[a-z]+:\/\//i.test(value), "Expected a file path, not a URL")
    .refine((value) => !value.includes(".."), "Path must not contain '..'"),
  name: z.string().trim().min(1).max(255),
  size: z.coerce.number().int().min(1).max(MAX_VIDEO_BYTES),
  mime_type: z
    .string()
    .trim()
    .max(120)
    .regex(/^video\//, "Only video files can be used here")
    .optional(),
  thumbnail_url: z.url().max(1000).optional(),
  width: z.coerce.number().int().min(0).max(20000).optional(),
  height: z.coerce.number().int().min(0).max(20000).optional(),
  duration: z.coerce.number().min(0).max(86400).optional(),
});

export type UploadedVideoInput = z.infer<typeof uploadedVideoSchema>;

/**
 * Blank strings arrive from HTML forms for untouched optional fields. On create,
 * "not supplied" and "supplied as blank" both mean no product.
 */
const optionalProductId = z
  .union([z.coerce.number().int().positive(), z.literal("")])
  .nullish()
  .transform((value) => (value === "" || value === undefined || value === null ? null : value));

/**
 * The PATCH version must keep those two cases apart: absent means "leave the
 * product alone", blank or null means "unlink it". Collapsing absent to null
 * would make every partial update — even a status toggle — clear the link.
 */
const patchProductId = z
  .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === "" || value === null ? null : value));

const statusFlag = z
  .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on"), z.literal("")])
  .optional()
  .transform((value) => value === true || value === "true" || value === "on");

export const createVideoSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(180),
  /** Optional: a video can be about the brand rather than one product. */
  product_id: optionalProductId,
  video: uploadedVideoSchema,
  is_active: statusFlag,
  order_by: z.coerce.number().int().min(0).max(9999).optional().default(0),
});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;

/** Every field optional — this is a PATCH. */
export const updateVideoSchema = z
  .object({
    title: z.string().trim().min(2).max(180).optional(),
    product_id: patchProductId,
    /** Supplying a new file replaces the old one, which is then deleted. */
    video: uploadedVideoSchema.optional(),
    is_active: z.boolean().optional(),
    order_by: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    "Nothing to update"
  );

export const listVideosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).default(20).catch(20),
  search: z.string().trim().min(1).max(120).optional().catch(undefined),
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
});
