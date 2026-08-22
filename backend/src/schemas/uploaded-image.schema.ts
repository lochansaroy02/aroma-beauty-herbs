import { z } from "zod";

/**
 * The descriptor POST /uploads returns, posted back with the form. Only the
 * fields worth persisting are accepted, so widening the upload response can't
 * reshape what lands in the database.
 *
 * Lived in product.schema.ts until the catalogue was removed; the homepage
 * tiles still upload images, so it moved here rather than leaving one schema
 * file to import from another domain's.
 */
export const uploadedImageSchema = z.object({
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
  size: z.coerce.number().int().min(0).max(25 * 1024 * 1024),
  mime_type: z
    .string()
    .trim()
    .max(120)
    .regex(/^image\//, "Only images can be used here")
    .optional(),
  thumbnail_url: z.url().max(1000).optional(),
  width: z.coerce.number().int().min(0).max(20000).optional(),
  height: z.coerce.number().int().min(0).max(20000).optional(),
  alt: z.string().trim().max(200).optional(),
});

export type UploadedImageInput = z.infer<typeof uploadedImageSchema>;
