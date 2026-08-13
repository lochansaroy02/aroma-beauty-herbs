import type { Request, Response } from "express";

import {
  LIVE_PRODUCT,
  productInclude,
  toProductCard,
  type ProductWithRelations,
} from "../lib/catalog";
import {
  GALLERY_COLLECTION,
  MAIN_IMAGE_COLLECTION,
  VIDEO_COLLECTION,
  VIDEO_SECTION_MODEL_TYPE,
  mediaSelect,
  toMediaPayload,
} from "../lib/media";
import { prisma } from "../lib/prisma";
import { imagesByProduct } from "../lib/product-images";
import { DEFAULT_LAYOUTS, SECTION_KEYS } from "../schemas/admin-home.schema";

/**
 * Everything the storefront homepage needs, in one round trip.
 *
 * Each block is independent: a missing hero or an empty strip table returns
 * null / [] rather than failing, so the page degrades to a still-coherent
 * layout on a fresh database instead of erroring.
 */

const ACTIVE = 1;

/** Small banners double as the tiles in the closing grid. */
const SMALL_BANNER_MODEL_TYPE = "App\\Models\\SmallBanner";

async function loadAnnouncement() {
  const row = await prisma.topBarText.findFirst({
    where: { deleted_at: null, status: ACTIVE },
    orderBy: [{ is_featured: "desc" }, { id: "desc" }],
    select: { id: true, name: true, url: true },
  });

  if (!row?.name) return null;
  return { id: row.id, text: row.name, url: row.url };
}

async function loadHero() {
  const section = await prisma.homeVideoSection.findFirst({
    where: { deleted_at: null, status: ACTIVE },
    orderBy: [{ order_by: "asc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      subtitle: true,
      url: true,
      cta_label: true,
      product: { select: { slug: true } },
    },
  });

  if (!section) return null;

  const file = await prisma.media.findFirst({
    where: {
      model_type: VIDEO_SECTION_MODEL_TYPE,
      model_id: section.id,
      collection_name: VIDEO_COLLECTION,
    },
    select: mediaSelect,
    orderBy: [{ order_column: "asc" }, { id: "asc" }],
  });

  if (!file) return null;

  return {
    id: section.id,
    title: section.title,
    subtitle: section.subtitle,
    // An explicit link wins; otherwise fall back to the linked product.
    url: section.url || (section.product?.slug ? `/products/${section.product.slug}` : null),
    cta_label: section.cta_label,
    video: toMediaPayload(file),
  };
}

async function loadStrips() {
  const strips = await prisma.homeStrip.findMany({
    where: { deleted_at: null, status: ACTIVE },
    orderBy: [{ order_by: "asc" }, { id: "asc" }],
    select: { id: true, text: true, direction: true, tone: true, speed: true, order_by: true },
  });

  return strips.map((strip) => ({
    id: strip.id,
    text: strip.text,
    direction: strip.direction === "right" ? "right" : "left",
    tone: strip.tone === "leaf" ? "leaf" : "ink",
    speed: strip.speed,
    order_by: strip.order_by,
  }));
}

/**
 * How the blocks are arranged. Defaults are returned for anything the admin
 * hasn't touched, so the storefront never has to reason about a partial or
 * absent arrangement.
 */
async function loadSections() {
  const rows = await prisma.homeSection.findMany();
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return SECTION_KEYS.map((key, index) => {
    const row = byKey.get(key);
    return {
      key,
      position: row?.position ?? index,
      is_visible: row?.is_visible ?? true,
      layout: row?.layout ?? DEFAULT_LAYOUTS[key],
    };
  }).sort((a, b) => a.position - b.position);
}

/**
 * The featured row. `is_featured` is the toggle and `order_by` is the running
 * order — both already editable in the product form, so no separate curation
 * screen is needed.
 */
async function loadFeatured() {
  const products = await prisma.product.findMany({
    where: { ...LIVE_PRODUCT, is_featured: true },
    include: productInclude,
    orderBy: [{ order_by: "asc" }, { id: "desc" }],
    take: 8,
  });

  const images = await imagesByProduct(products.map((product) => product.id));

  return products.map((product: ProductWithRelations) =>
    toProductCard(product, images.get(product.id))
  );
}

async function loadTiles() {
  const banners = await prisma.smallBanner.findMany({
    where: { deleted_at: null, status: ACTIVE },
    orderBy: [{ order_by: "asc" }, { id: "asc" }],
    take: 6,
    select: { id: true, name: true, slug: true, url: true },
  });

  if (!banners.length) return [];

  const media = await prisma.media.findMany({
    where: {
      model_type: SMALL_BANNER_MODEL_TYPE,
      model_id: { in: banners.map((banner) => banner.id) },
      collection_name: { in: [MAIN_IMAGE_COLLECTION, GALLERY_COLLECTION] },
    },
    select: { ...mediaSelect, model_id: true },
    orderBy: [{ order_column: "asc" }, { id: "asc" }],
  });

  const byBanner = new Map(media.map((row) => [row.model_id, row]));

  return banners.map((banner) => {
    const image = byBanner.get(banner.id);
    return {
      id: banner.id,
      title: banner.name,
      /** `slug` carries the standfirst — it's the only spare text column. */
      caption: banner.slug,
      url: banner.url,
      image: image ? toMediaPayload(image) : null,
    };
  });
}

/** GET /home */
export async function getHome(_req: Request, res: Response) {
  const [announcement, hero, strips, featured, tiles, sections] = await Promise.all([
    loadAnnouncement(),
    loadHero(),
    loadStrips(),
    loadFeatured(),
    loadTiles(),
    loadSections(),
  ]);

  return res.status(200).json({ announcement, hero, strips, featured, tiles, sections });
}
