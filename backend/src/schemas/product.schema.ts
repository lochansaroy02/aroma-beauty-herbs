import { z } from "zod";

export const PRODUCT_SORTS = [
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
  "price_asc",
  "price_desc",
  "featured",
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

const optionalText = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .optional()
  .catch(undefined);

export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  // Capped so a caller can't ask for the whole catalogue in one request.
  limit: z.coerce.number().int().min(1).max(60).default(20).catch(20),
  search: optionalText,
  /** Category slug or numeric id. */
  category: optionalText,
  /** Brand slug or numeric id. */
  brand: optionalText,
  featured: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional()
    .catch(undefined),
  sort: z.enum(PRODUCT_SORTS).default("newest").catch("newest"),
});

export type ListProductsQuery = z.infer<typeof listProductsSchema>;

/** Ten per product keeps the listing payload and the media library sane. */
export const MAX_GALLERY_IMAGES = 10;

/**
 * The descriptor POST /uploads returns, posted back with the form. Only the
 * fields worth persisting are accepted, so widening the upload response can't
 * reshape what lands in the database.
 */
export const uploadedImageSchema = z.object({
  // The stored path, which is also how the file is deleted later.
  file_id: z.string().trim().min(1).max(500),
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
    .regex(/^image\//, "Only images can be attached to a product")
    .optional(),
  width: z.coerce.number().int().min(0).max(20000).optional(),
  height: z.coerce.number().int().min(0).max(20000).optional(),
  alt: z.string().trim().max(200).optional(),
});

export type UploadedImageInput = z.infer<typeof uploadedImageSchema>;

export const attachImagesSchema = z.object({
  images: z.array(uploadedImageSchema).min(1).max(MAX_GALLERY_IMAGES),
  /** "main" replaces the hero image; "gallery" appends. */
  collection: z.enum(["main", "gallery"]).default("gallery"),
});

/** Blank strings arrive from HTML forms for untouched optional fields. */
const optionalId = z
  .union([z.coerce.number().int().positive(), z.literal("")])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

/**
 * The PATCH counterpart. `optionalId` maps absent → null, which on an update
 * would mean "omitting brand_id clears the brand". This leaves absent absent,
 * and only an explicit "" or null unlinks.
 */
const patchId = z
  .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === "" || value === null ? null : value));

const money = z.coerce.number().min(0).max(99_999_999);

/**
 * Capped before sanitising — an admin pasting a whole Word document is a real
 * failure mode, not a hypothetical.
 */
const richText = z.string().max(50_000, "That's too long — keep it under 50,000 characters");

/** Indian GST slabs. A closed list keeps the two tax columns in step. */
export const GST_SLABS = [0, 5, 12, 18, 28] as const;
export const DEFAULT_GST_SLAB = 18;

const taxRate = z.coerce
  .number()
  .refine((value) => (GST_SLABS as readonly number[]).includes(value), "Not a valid GST slab");

/**
 * A closed list, not free text. `badge_style` has no renderer yet; if it fills
 * with typos now, writing one later becomes archaeology.
 */
export const BADGE_STYLES = ["none", "new", "bestseller", "sale", "limited"] as const;

const badgeStyle = z.enum(BADGE_STYLES);

const sku = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, dashes and underscores");

const statusFlag = z
  .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on"), z.literal("")])
  .optional()
  .transform((value) => value === true || value === "true" || value === "on");

const createProductBase = z.object({
  product_name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(180, "Name must be at most 180 characters"),
  // Both are derived from the name when omitted.
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
    .max(180)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  product_code: z.string().trim().max(60).optional().or(z.literal("").transform(() => undefined)),
  short_description: z.string().trim().max(500).optional(),
  description: richText.optional(),
  how_to_use: richText.optional(),
  specific_item_info: richText.optional(),
  meta_title: z.string().trim().max(180).optional(),
  // The column is VarChar(300); Postgres would otherwise throw a raw error.
  meta_description: z.string().trim().max(300).optional(),
  category_id: optionalId,
  brand_id: optionalId,
  sku: sku.optional(),
  mrp: money.optional().default(0),
  sale_price: money,
  tax_rate: taxRate.optional().default(DEFAULT_GST_SLAB),
  stock_qty: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  /** Warn when available stock drops to this. Zero disables the alert. */
  low_stock_alert: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  is_featured: statusFlag,
  is_combo: statusFlag,
  badge_style: badgeStyle.optional().default("none"),
  order_by: z.coerce.number().int().min(0).max(100_000).optional().default(0),
  /** 1 active, 0 draft. Defaults to active so the old behaviour is unchanged. */
  status: z.union([z.literal(0), z.literal(1)]).optional().default(1),

  // Both optional: a product can be created now and photographed later.
  main_image: uploadedImageSchema.nullish().transform((value) => value ?? null),
  gallery: z.array(uploadedImageSchema).max(MAX_GALLERY_IMAGES).optional().default([]),
});

/** Mirrors isBlankRichText in lib/sanitize.ts — `<p></p>` is an empty editor. */
function blankHtml(html: string | undefined): boolean {
  return !html || html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}

/**
 * Required-ness is enforced on create only.
 *
 * A new product has no excuse for being incomplete, but every product that
 * predates this form has a null description and no brand — demanding them on
 * PATCH too would lock those rows out of being saved at all. The client gates
 * the same set when editing, so the rule still reaches the admin either way.
 */
export const createProductSchema = createProductBase.superRefine((value, ctx) => {
  if (value.brand_id === null) {
    ctx.addIssue({ code: "custom", path: ["brand_id"], message: "Choose a brand" });
  }
  if (value.category_id === null) {
    ctx.addIssue({ code: "custom", path: ["category_id"], message: "Choose a category" });
  }
  if (!value.short_description?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["short_description"],
      message: "Write a short description",
    });
  }
  if (blankHtml(value.description)) {
    ctx.addIssue({ code: "custom", path: ["description"], message: "Write a description" });
  }
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Every key optional — this is a genuine PATCH, and the client is what enforces
 * the required set on edit. Making the API demand a description too would lock
 * every pre-existing product out of being saved at all.
 *
 * `product_code` is absent on purpose: it's the business key, it's displayed and
 * searchable, and the default SKU derives from it. `slug` is absent because
 * there's no redirect table, so renaming one would break every live URL.
 */
export const updateProductSchema = z.object({
  product_name: z.string().trim().min(2).max(180).optional(),
  short_description: z.string().trim().max(500).optional(),
  description: richText.optional(),
  how_to_use: richText.optional(),
  specific_item_info: richText.optional(),
  meta_title: z.string().trim().max(180).optional(),
  meta_description: z.string().trim().max(300).optional(),
  category_id: patchId,
  brand_id: patchId,

  status: z.union([z.literal(0), z.literal(1)]).optional(),
  is_featured: z.boolean().optional(),
  is_combo: z.boolean().optional(),
  badge_style: badgeStyle.optional(),
  order_by: z.coerce.number().int().min(0).max(100_000).optional(),
  tax_rate: taxRate.optional(),

  // The single default variant.
  sku: sku.optional(),
  mrp: money.optional(),
  sale_price: money.optional(),
  stock_qty: z.coerce.number().int().min(0).max(1_000_000).optional(),
  low_stock_alert: z.coerce.number().int().min(0).max(1_000_000).optional(),

  // Image deltas rather than a whole set, so an unchanged gallery costs nothing.
  main_image: uploadedImageSchema.optional(),
  remove_main_image: z.boolean().optional().default(false),
  gallery_add: z.array(uploadedImageSchema).max(MAX_GALLERY_IMAGES).optional().default([]),
  gallery_remove: z
    .array(z.coerce.number().int().positive())
    .max(MAX_GALLERY_IMAGES)
    .optional()
    .default([]),

  /** Optimistic concurrency — the `updated_at` the editor was opened with. */
  expected_updated_at: z.string().trim().max(40).optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listAdminProductsSchema = listProductsSchema.extend({
  status: z.enum(["all", "active", "inactive"]).default("all").catch("all"),
});
