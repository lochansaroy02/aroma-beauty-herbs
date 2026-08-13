import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error";
import {
  GALLERY_COLLECTION,
  MAIN_IMAGE_COLLECTION,
  createMediaRows,
  fileIdsOf,
  mediaSelect,
  toMediaPayload,
} from "../lib/media";
import { prisma } from "../lib/prisma";
import { deleteMediaFiles } from "../lib/storage";
import {
  DEFAULT_LAYOUTS,
  SECTION_KEYS,
  announcementSchema,
  createStripSchema,
  createTileSchema,
  reorderSchema,
  updateSectionsSchema,
  updateStripSchema,
  updateTileSchema,
  type SectionKey,
} from "../schemas/admin-home.schema";

/**
 * Everything on the homepage that isn't a product: the announcement bar, the
 * scrolling strips, the closing grid, and how the blocks are arranged.
 *
 * The hero video keeps its own CRUD under /admin/videos — this only reads it,
 * so there is one place that owns uploads of that size.
 */

const ACTIVE = 1;
const INACTIVE = 0;

/** Small banners double as the tiles in the closing grid. */
const SMALL_BANNER_MODEL_TYPE = "App\\Models\\SmallBanner";

function idParam(req: Request): number {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
}

function parseOrThrow<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

/** One past the current highest, so a new row lands at the end of the list. */
async function nextOrder(kind: "strip" | "tile"): Promise<number> {
  if (kind === "strip") {
    const last = await prisma.homeStrip.findFirst({
      where: { deleted_at: null },
      orderBy: { order_by: "desc" },
      select: { order_by: true },
    });
    return (last?.order_by ?? 0) + 1;
  }

  const last = await prisma.smallBanner.findFirst({
    where: { deleted_at: null },
    orderBy: { order_by: "desc" },
    select: { order_by: true },
  });
  return (last?.order_by ?? 0) + 1;
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

async function loadStrips() {
  const strips = await prisma.homeStrip.findMany({
    where: { deleted_at: null },
    orderBy: [{ order_by: "asc" }, { id: "asc" }],
  });

  return strips.map((strip) => ({
    id: strip.id,
    text: strip.text,
    direction: strip.direction === "right" ? "right" : "left",
    tone: strip.tone === "leaf" ? "leaf" : "ink",
    speed: strip.speed,
    order_by: strip.order_by,
    is_active: strip.status === ACTIVE,
  }));
}

async function loadTiles() {
  const banners = await prisma.smallBanner.findMany({
    where: { deleted_at: null },
    orderBy: [{ order_by: "asc" }, { id: "asc" }],
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
      caption: banner.slug,
      url: banner.url,
      order_by: banner.order_by,
      is_active: banner.status === ACTIVE,
      image: image ? toMediaPayload(image) : null,
    };
  });
}

async function loadAnnouncement() {
  const row = await prisma.topBarText.findFirst({
    where: { deleted_at: null },
    orderBy: [{ is_featured: "desc" }, { id: "desc" }],
  });

  if (!row) return null;
  return {
    id: row.id,
    text: row.name ?? "",
    url: row.url,
    is_active: row.status === ACTIVE,
  };
}

/**
 * Sections, with any missing key filled in at its default. Reading is what
 * creates them, so a database that predates this feature answers with a
 * complete, sensible arrangement rather than an empty list.
 */
async function loadSections() {
  const rows = await prisma.homeSection.findMany();
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const missing = SECTION_KEYS.filter((key) => !byKey.has(key));

  if (missing.length) {
    await prisma.homeSection.createMany({
      data: missing.map((key) => ({
        key,
        position: SECTION_KEYS.indexOf(key),
        is_visible: true,
        layout: DEFAULT_LAYOUTS[key],
      })),
      skipDuplicates: true,
    });

    return loadSections();
  }

  return SECTION_KEYS.map((key) => {
    const row = byKey.get(key)!;
    return {
      key,
      position: row.position,
      is_visible: row.is_visible,
      layout: row.layout ?? DEFAULT_LAYOUTS[key],
    };
  }).sort((a, b) => a.position - b.position);
}

/** GET /admin/home — everything the customisation screen edits, in one trip. */
export async function getAdminHome(_req: Request, res: Response) {
  const [announcement, strips, tiles, sections, heroCount] = await Promise.all([
    loadAnnouncement(),
    loadStrips(),
    loadTiles(),
    loadSections(),
    prisma.homeVideoSection.count({ where: { deleted_at: null, status: ACTIVE } }),
  ]);

  return res.status(200).json({
    announcement,
    strips,
    tiles,
    sections,
    hero: { configured: heroCount > 0, count: heroCount },
  });
}

/* ── Strips ─────────────────────────────────────────────────────────────── */

export async function createStrip(req: Request, res: Response) {
  const input = parseOrThrow(createStripSchema, req.body);

  const strip = await prisma.homeStrip.create({
    data: {
      text: input.text,
      direction: input.direction,
      tone: input.tone,
      speed: input.speed ?? null,
      // 0 means "the caller didn't choose" — append rather than jump the queue,
      // which is what a new row visibly doing so looks like from the admin.
      order_by: input.order_by || (await nextOrder("strip")),
      status: input.is_active ? ACTIVE : INACTIVE,
      created_by_id: req.auth?.userId ?? null,
    },
  });

  return res.status(201).json({ strip: { id: strip.id } });
}

export async function updateStrip(req: Request, res: Response) {
  const id = idParam(req);
  const input = parseOrThrow(updateStripSchema, req.body);

  const existing = await prisma.homeStrip.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw new HttpError(404, "Strip not found");

  await prisma.homeStrip.update({
    where: { id },
    data: {
      ...(input.text !== undefined ? { text: input.text } : {}),
      ...(input.direction !== undefined ? { direction: input.direction } : {}),
      ...(input.tone !== undefined ? { tone: input.tone } : {}),
      ...(input.speed !== undefined ? { speed: input.speed ?? null } : {}),
      ...(input.order_by !== undefined ? { order_by: input.order_by } : {}),
      ...(input.is_active !== undefined
        ? { status: input.is_active ? ACTIVE : INACTIVE }
        : {}),
      updated_by_id: req.auth?.userId ?? null,
    },
  });

  return res.status(200).json({ strip: { id } });
}

export async function deleteStrip(req: Request, res: Response) {
  const id = idParam(req);
  const existing = await prisma.homeStrip.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw new HttpError(404, "Strip not found");

  // Soft delete, matching every other table here.
  await prisma.homeStrip.update({ where: { id }, data: { deleted_at: new Date() } });
  return res.status(200).json({ deleted: id });
}

/** POST /admin/home/strips/reorder — ids in their new running order. */
export async function reorderStrips(req: Request, res: Response) {
  const { order } = parseOrThrow(reorderSchema, req.body);

  await prisma.$transaction(
    order.map((id, index) =>
      prisma.homeStrip.updateMany({
        where: { id, deleted_at: null },
        data: { order_by: index + 1 },
      })
    )
  );

  return res.status(200).json({ reordered: order.length });
}

/* ── Tiles ──────────────────────────────────────────────────────────────── */

export async function createTile(req: Request, res: Response) {
  const input = parseOrThrow(createTileSchema, req.body);

  try {
    const tile = await prisma.$transaction(async (tx) => {
      const banner = await tx.smallBanner.create({
        data: {
          name: input.title,
          slug: input.caption ?? null,
          url: input.url ?? null,
          order_by: input.order_by || (await nextOrder("tile")),
          status: input.is_active ? ACTIVE : INACTIVE,
          created_by_id: req.auth?.userId ?? null,
        },
      });

      if (input.image) {
        await createMediaRows(tx, {
          modelType: SMALL_BANNER_MODEL_TYPE,
          modelId: banner.id,
          collection: MAIN_IMAGE_COLLECTION,
          files: [input.image],
        });
      }

      return banner;
    });

    return res.status(201).json({ tile: { id: tile.id } });
  } catch (error) {
    // Nothing references the upload now, so don't leave it on disk.
    if (input.image) await deleteMediaFiles([input.image.file_id]);
    throw error;
  }
}

export async function updateTile(req: Request, res: Response) {
  const id = idParam(req);
  const input = parseOrThrow(updateTileSchema, req.body);

  const existing = await prisma.smallBanner.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw new HttpError(404, "Tile not found");

  let replaced: { custom_properties: unknown }[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.smallBanner.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { name: input.title } : {}),
          ...(input.caption !== undefined ? { slug: input.caption ?? null } : {}),
          ...(input.url !== undefined ? { url: input.url ?? null } : {}),
          ...(input.order_by !== undefined ? { order_by: input.order_by } : {}),
          ...(input.is_active !== undefined
            ? { status: input.is_active ? ACTIVE : INACTIVE }
            : {}),
          updated_by_id: req.auth?.userId ?? null,
        },
      });

      if (input.image) {
        // One image per tile: collect the old rows, then swap.
        const old = await tx.media.findMany({
          where: {
            model_type: SMALL_BANNER_MODEL_TYPE,
            model_id: id,
            collection_name: { in: [MAIN_IMAGE_COLLECTION, GALLERY_COLLECTION] },
          },
          select: { id: true, custom_properties: true },
        });

        replaced = old;

        await tx.media.deleteMany({ where: { id: { in: old.map((row) => row.id) } } });
        await createMediaRows(tx, {
          modelType: SMALL_BANNER_MODEL_TYPE,
          modelId: id,
          collection: MAIN_IMAGE_COLLECTION,
          files: [input.image],
        });
      }
    });
  } catch (error) {
    if (input.image) await deleteMediaFiles([input.image.file_id]);
    throw error;
  }

  // Only once the swap is committed is the old file safe to remove.
  if (replaced.length) {
    await deleteMediaFiles(fileIdsOf(replaced as Parameters<typeof fileIdsOf>[0]));
  }

  return res.status(200).json({ tile: { id } });
}

export async function deleteTile(req: Request, res: Response) {
  const id = idParam(req);
  const existing = await prisma.smallBanner.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw new HttpError(404, "Tile not found");

  const files = await prisma.media.findMany({
    where: { model_type: SMALL_BANNER_MODEL_TYPE, model_id: id },
    select: { id: true, custom_properties: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.media.deleteMany({ where: { id: { in: files.map((row) => row.id) } } });
    await tx.smallBanner.update({ where: { id }, data: { deleted_at: new Date() } });
  });

  await deleteMediaFiles(fileIdsOf(files as Parameters<typeof fileIdsOf>[0]));
  return res.status(200).json({ deleted: id });
}

export async function reorderTiles(req: Request, res: Response) {
  const { order } = parseOrThrow(reorderSchema, req.body);

  await prisma.$transaction(
    order.map((id, index) =>
      prisma.smallBanner.updateMany({
        where: { id, deleted_at: null },
        data: { order_by: index + 1 },
      })
    )
  );

  return res.status(200).json({ reordered: order.length });
}

/* ── Announcement ───────────────────────────────────────────────────────── */

/** PUT /admin/home/announcement — one bar, so this upserts rather than creates. */
export async function saveAnnouncement(req: Request, res: Response) {
  const input = parseOrThrow(announcementSchema, req.body);
  const existing = await prisma.topBarText.findFirst({
    where: { deleted_at: null },
    orderBy: [{ is_featured: "desc" }, { id: "desc" }],
  });

  const data = {
    name: input.text,
    url: input.url ?? null,
    status: input.is_active ? ACTIVE : INACTIVE,
  };

  const row = existing
    ? await prisma.topBarText.update({ where: { id: existing.id }, data })
    : await prisma.topBarText.create({ data: { ...data, is_featured: 1 } });

  return res.status(200).json({ announcement: { id: row.id } });
}

/* ── Sections ───────────────────────────────────────────────────────────── */

/** PATCH /admin/home/sections — order, visibility and layout in one write. */
export async function updateSections(req: Request, res: Response) {
  const { sections } = parseOrThrow(updateSectionsSchema, req.body);

  await prisma.$transaction(
    sections.map((section) =>
      prisma.homeSection.upsert({
        where: { key: section.key },
        update: {
          position: section.position,
          is_visible: section.is_visible,
          layout: section.layout ?? DEFAULT_LAYOUTS[section.key as SectionKey],
        },
        create: {
          key: section.key,
          position: section.position,
          is_visible: section.is_visible,
          layout: section.layout ?? DEFAULT_LAYOUTS[section.key as SectionKey],
        },
      })
    )
  );

  return res.status(200).json({ updated: sections.length });
}
