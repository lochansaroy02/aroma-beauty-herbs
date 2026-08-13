import type { Request, Response } from "express";
import { z } from "zod";

import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../lib/http-error";
import { deleteMediaFiles } from "../lib/storage";
import {
  VIDEO_COLLECTION,
  VIDEO_SECTION_MODEL_TYPE,
  createMediaRows,
  fileIdsOf,
  mediaSelect,
  toMediaPayload,
  type MediaRow,
} from "../lib/media";
import { prisma } from "../lib/prisma";
import {
  createVideoSchema,
  listVideosSchema,
  updateVideoSchema,
} from "../schemas/video.schema";

/**
 * Videos live in `home_video_sections`; the file itself is a media row against
 * the section's polymorphic key, exactly like product images. `status` is the
 * Laravel-style 1/0 int the rest of the schema uses.
 */
const ACTIVE = 1;
const INACTIVE = 0;

const videoSelect = {
  id: true,
  title: true,
  product_id: true,
  order_by: true,
  status: true,
  created_at: true,
  updated_at: true,
  product: { select: { id: true, product_name: true, slug: true } },
} satisfies Prisma.HomeVideoSectionSelect;

type VideoRow = Prisma.HomeVideoSectionGetPayload<{ select: typeof videoSelect }>;

/** Media is polymorphic, so the files come from a second, grouped query. */
async function filesByVideo(ids: number[]): Promise<Map<number, MediaRow>> {
  const map = new Map<number, MediaRow>();
  if (!ids.length) return map;

  const rows = await prisma.media.findMany({
    where: {
      model_type: VIDEO_SECTION_MODEL_TYPE,
      model_id: { in: ids },
      collection_name: VIDEO_COLLECTION,
    },
    select: { ...mediaSelect, model_id: true },
    orderBy: [{ order_column: "asc" }, { id: "asc" }],
  });

  // One file per section; a later row would only exist mid-replacement.
  for (const row of rows) {
    if (!map.has(row.model_id)) map.set(row.model_id, row);
  }

  return map;
}

function toVideoPayload(video: VideoRow, file: MediaRow | undefined) {
  return {
    id: video.id,
    title: video.title,
    product: video.product,
    is_active: video.status === ACTIVE,
    order_by: video.order_by ?? 0,
    video: file ? toMediaPayload(file) : null,
    created_at: video.created_at,
    updated_at: video.updated_at,
  };
}

async function loadVideo(id: number) {
  const video = await prisma.homeVideoSection.findFirst({
    where: { id, deleted_at: null },
    select: videoSelect,
  });

  if (!video) throw new HttpError(404, "Video not found");

  const files = await filesByVideo([video.id]);
  return toVideoPayload(video, files.get(video.id));
}

function numericParam(value: unknown): number {
  return typeof value === "string" && value !== "" ? Number(value) : Number.NaN;
}

function videoId(req: Request): number {
  const id = numericParam(req.params["id"]);
  if (!Number.isInteger(id)) throw new HttpError(400, "Video id must be a number");
  return id;
}

/** Rejects a product reference that doesn't exist, rather than a raw FK error. */
async function assertProductExists(productId: number | null) {
  if (productId === null) return;

  const product = await prisma.product.findFirst({
    where: { id: productId, deleted_at: null },
    select: { id: true },
  });

  if (!product) {
    throw new HttpError(422, "Validation failed", { product_id: ["Product not found"] });
  }
}

/** GET /admin/videos — everything, including inactive. */
export async function listVideos(req: Request, res: Response) {
  const query = listVideosSchema.parse(req.query);

  const where: Prisma.HomeVideoSectionWhereInput = {
    deleted_at: null,
    ...(query.status ? { status: query.status === "active" ? ACTIVE : INACTIVE } : {}),
    ...(query.search
      ? { title: { contains: query.search, mode: "insensitive" } }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, videos] = await Promise.all([
    prisma.homeVideoSection.count({ where }),
    prisma.homeVideoSection.findMany({
      where,
      select: videoSelect,
      orderBy: [{ order_by: "asc" }, { id: "desc" }],
      skip,
      take: query.limit,
    }),
  ]);

  const files = await filesByVideo(videos.map((video) => video.id));

  return res.status(200).json({
    videos: videos.map((video) => toVideoPayload(video, files.get(video.id))),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.limit)),
      has_more: skip + videos.length < total,
    },
    applied: { search: query.search ?? null, status: query.status ?? null },
  });
}

/**
 * GET /videos — active videos only, for whatever the storefront ends up doing
 * with them. Public because that's where they'll be shown.
 */
export async function listActiveVideos(_req: Request, res: Response) {
  const videos = await prisma.homeVideoSection.findMany({
    where: { deleted_at: null, status: ACTIVE },
    select: videoSelect,
    orderBy: [{ order_by: "asc" }, { id: "desc" }],
    take: 50,
  });

  const files = await filesByVideo(videos.map((video) => video.id));

  // A section with no file attached would render as an empty player.
  const payload = videos
    .map((video) => toVideoPayload(video, files.get(video.id)))
    .filter((video) => video.video !== null);

  return res.status(200).json({ videos: payload });
}

/** GET /admin/videos/:id */
export async function getVideo(req: Request, res: Response) {
  return res.status(200).json({ video: await loadVideo(videoId(req)) });
}

/** POST /admin/videos — the file is already in local media storage by this point. */
export async function createVideo(req: Request, res: Response) {

  const parsed = createVideoSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const input = parsed.data;

  try {
    await assertProductExists(input.product_id);
  } catch (error) {
    // Nothing will reference the upload, so don't leave it in the library.
    await deleteMediaFiles([input.video]);
    throw error;
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const video = await tx.homeVideoSection.create({
        data: {
          title: input.title,
          product_id: input.product_id,
          status: input.is_active ? ACTIVE : INACTIVE,
          order_by: input.order_by,
          created_by_id: req.auth?.userId ?? null,
        },
      });

      await createMediaRows(tx, {
        modelType: VIDEO_SECTION_MODEL_TYPE,
        modelId: video.id,
        collection: VIDEO_COLLECTION,
        files: [input.video],
      });

      return video;
    });

    return res.status(201).json({ video: await loadVideo(created.id) });
  } catch (error) {
    await deleteMediaFiles([input.video]);
    throw error;
  }
}

/**
 * PATCH /admin/videos/:id — title, product, status, order, or a replacement
 * file. Replacing deletes the old file once the new row is committed.
 */
export async function updateVideo(req: Request, res: Response) {
  const id = videoId(req);
  const parsed = updateVideoSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const input = parsed.data;

  const existing = await prisma.homeVideoSection.findFirst({
    where: { id, deleted_at: null },
    select: { id: true },
  });

  if (!existing) {
    if (input.video) await deleteMediaFiles([input.video]);
    throw new HttpError(404, "Video not found");
  }

  if (input.product_id !== undefined) {
    await assertProductExists(input.product_id);
  }

  // Captured before the swap so the old file can be removed afterwards.
  const replaced = input.video
    ? await prisma.media.findMany({
        where: {
          model_type: VIDEO_SECTION_MODEL_TYPE,
          model_id: id,
          collection_name: VIDEO_COLLECTION,
        },
        select: { id: true, disk: true, custom_properties: true },
      })
    : [];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.homeVideoSection.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.product_id !== undefined ? { product_id: input.product_id } : {}),
          ...(input.is_active !== undefined
            ? { status: input.is_active ? ACTIVE : INACTIVE }
            : {}),
          ...(input.order_by !== undefined ? { order_by: input.order_by } : {}),
          updated_by_id: req.auth?.userId ?? null,
        },
      });

      if (input.video) {
        if (replaced.length) {
          await tx.media.deleteMany({ where: { id: { in: replaced.map((row) => row.id) } } });
        }

        await createMediaRows(tx, {
          modelType: VIDEO_SECTION_MODEL_TYPE,
          modelId: id,
          collection: VIDEO_COLLECTION,
          files: [input.video],
        });
      }
    });
  } catch (error) {
    if (input.video) await deleteMediaFiles([input.video]);
    throw error;
  }

  // The old file is now unreferenced.
  if (replaced.length) await deleteMediaFiles(fileIdsOf(replaced));

  return res.status(200).json({ video: await loadVideo(id) });
}

/**
 * DELETE /admin/videos/:id — soft-deletes the section and hard-deletes the
 * file. Keeping the row preserves any reference to it; keeping a 40MB video
 * nobody can reach just costs money.
 */
export async function deleteVideo(req: Request, res: Response) {
  const id = videoId(req);

  const existing = await prisma.homeVideoSection.findFirst({
    where: { id, deleted_at: null },
    select: { id: true },
  });

  if (!existing) throw new HttpError(404, "Video not found");

  const files = await prisma.media.findMany({
    where: {
      model_type: VIDEO_SECTION_MODEL_TYPE,
      model_id: id,
      collection_name: VIDEO_COLLECTION,
    },
    select: { id: true, disk: true, custom_properties: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.homeVideoSection.update({
      where: { id },
      data: { deleted_at: new Date(), status: INACTIVE },
    });

    if (files.length) {
      await tx.media.deleteMany({ where: { id: { in: files.map((row) => row.id) } } });
    }
  });

  await deleteMediaFiles(fileIdsOf(files));

  return res.status(200).json({ deleted: id });
}
