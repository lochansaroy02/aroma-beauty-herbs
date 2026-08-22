import { z } from "zod";

import { uploadedImageSchema } from "./uploaded-image.schema";

/**
 * The homepage's editable furniture.
 *
 * Layout values are closed enums rather than free text: the storefront maps
 * each one to a specific arrangement, so an unknown value would render nothing.
 * Anything not listed here is rejected at the boundary instead of failing later
 * as a blank section.
 */

export const STRIP_TONES = ["ink", "leaf"] as const;
export const STRIP_DIRECTIONS = ["left", "right"] as const;

export const HERO_LAYOUTS = ["full", "contained", "split"] as const;
export const TILE_LAYOUTS = ["three", "two", "feature"] as const;
export const FEATURED_LAYOUTS = ["row", "grid"] as const;

/** The closed set of homepage blocks, in their default running order. */
export const SECTION_KEYS = [
  "announcement",
  "hero",
  "strip_a",
  "featured",
  "strip_b",
  "tiles",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

/** Which layout enum applies to which block. Keys with no variants map to []. */
export const LAYOUTS_BY_KEY: Record<SectionKey, readonly string[]> = {
  announcement: [],
  hero: HERO_LAYOUTS,
  strip_a: [],
  featured: FEATURED_LAYOUTS,
  strip_b: [],
  tiles: TILE_LAYOUTS,
};

export const DEFAULT_LAYOUTS: Record<SectionKey, string | null> = {
  announcement: null,
  hero: "full",
  strip_a: null,
  featured: "row",
  strip_b: null,
  tiles: "three",
};

/* ── Strips ─────────────────────────────────────────────────────────────── */

/**
 * Field validators are declared once and composed two ways, because `.partial()`
 * on a schema carrying `.default()` does NOT stop the defaults being applied —
 * an absent key still parses to its default, which a PATCH handler cannot
 * distinguish from "the caller sent this value". Building the update schema
 * from bare fields is what keeps a one-field edit from resetting the rest.
 */
const stripFields = {
  text: z.string().trim().min(2).max(160),
  direction: z.enum(STRIP_DIRECTIONS),
  tone: z.enum(STRIP_TONES),
  /** Seconds per loop. Null lets the storefront derive it from the text length. */
  speed: z.coerce.number().int().min(10).max(120).nullable(),
  order_by: z.coerce.number().int().min(0).max(999),
  is_active: z.boolean(),
};

export const createStripSchema = z.object({
  ...stripFields,
  direction: stripFields.direction.default("left"),
  tone: stripFields.tone.default("ink"),
  speed: stripFields.speed.nullish(),
  order_by: stripFields.order_by.default(0),
  is_active: stripFields.is_active.default(true),
});

export const updateStripSchema = z.object({
  text: stripFields.text.optional(),
  direction: stripFields.direction.optional(),
  tone: stripFields.tone.optional(),
  speed: stripFields.speed.optional(),
  order_by: stripFields.order_by.optional(),
  is_active: stripFields.is_active.optional(),
});

/* ── Tiles (small banners) ──────────────────────────────────────────────── */

const tileFields = {
  title: z.string().trim().min(1).max(120),
  /** `slug` is the only spare text column, so it carries the standfirst. */
  caption: z.string().trim().max(200).nullable(),
  url: z.string().trim().max(500).nullable(),
  order_by: z.coerce.number().int().min(0).max(999),
  is_active: z.boolean(),
  image: uploadedImageSchema.nullable(),
};

export const createTileSchema = z.object({
  ...tileFields,
  caption: tileFields.caption.nullish(),
  url: tileFields.url.nullish(),
  order_by: tileFields.order_by.default(0),
  is_active: tileFields.is_active.default(true),
  image: tileFields.image.nullish(),
});

/** Same reasoning as updateStripSchema: no defaults, so absent means absent. */
export const updateTileSchema = z.object({
  title: tileFields.title.optional(),
  caption: tileFields.caption.optional(),
  url: tileFields.url.optional(),
  order_by: tileFields.order_by.optional(),
  is_active: tileFields.is_active.optional(),
  image: tileFields.image.optional(),
});

/* ── Announcement bar ───────────────────────────────────────────────────── */

export const announcementSchema = z.object({
  text: z.string().trim().min(2).max(160),
  url: z.string().trim().max(500).nullish(),
  is_active: z.boolean().default(true),
});

/* ── Sections (order, visibility, layout) ───────────────────────────────── */

const sectionSchema = z
  .object({
    key: z.enum(SECTION_KEYS),
    position: z.coerce.number().int().min(0).max(50),
    is_visible: z.boolean(),
    layout: z.string().trim().max(40).nullish(),
  })
  .refine(
    (value) => {
      const allowed = LAYOUTS_BY_KEY[value.key];
      if (!value.layout) return true;
      return allowed.includes(value.layout);
    },
    { message: "That layout isn't available for this section", path: ["layout"] }
  );

export const updateSectionsSchema = z.object({
  sections: z.array(sectionSchema).min(1).max(SECTION_KEYS.length),
});

export const reorderSchema = z.object({
  order: z.array(z.coerce.number().int().positive()).min(1).max(50),
});
