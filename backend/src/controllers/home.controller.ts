import type { Request, Response } from "express";

import {
  GALLERY_COLLECTION,
  MAIN_IMAGE_COLLECTION,
  VIDEO_COLLECTION,
  VIDEO_SECTION_MODEL_TYPE,
  mediaSelect,
  toMediaPayload,
} from "../lib/media";
import { prisma } from "../lib/prisma";
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
    // Whatever the admin typed. With no local catalogue there is no product
    // page to fall back to, so an empty field means the hero simply isn't a link.
    url: section.url || null,
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
  const [announcement, hero, strips, tiles, sections] = await Promise.all([
    loadAnnouncement(),
    loadHero(),
    loadStrips(),
    loadTiles(),
    loadSections(),
  ]);

  /**
   * No `featured` key: the products in that block come from the
   * barbersyndicate.in API and are fetched by the frontend directly. The block
   * still appears here in `sections`, because its order, visibility and layout
   * are still ours to edit — only its contents moved.
   */
  return res.status(200).json({ announcement, hero, strips, tiles, sections });
}
