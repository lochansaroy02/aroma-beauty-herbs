import {
  GALLERY_COLLECTION,
  MAIN_IMAGE_COLLECTION,
  PRODUCT_MODEL_TYPE,
  mediaSelect,
  toMediaPayload,
  type MediaRow,
} from "./media";
import { prisma } from "./prisma";

/**
 * Media is polymorphic, so images can't be pulled in through a Prisma relation.
 * One grouped query per request keeps that from becoming N+1.
 */
export async function imagesByProduct(
  productIds: number[]
): Promise<Map<number, MediaRow[]>> {
  const grouped = new Map<number, MediaRow[]>();
  if (!productIds.length) return grouped;

  const rows = await prisma.media.findMany({
    where: {
      model_type: PRODUCT_MODEL_TYPE,
      model_id: { in: productIds },
      collection_name: { in: [MAIN_IMAGE_COLLECTION, GALLERY_COLLECTION] },
    },
    select: { ...mediaSelect, model_id: true },
    orderBy: [{ order_column: "asc" }, { id: "asc" }],
  });

  for (const row of rows) {
    const list = grouped.get(row.model_id) ?? [];
    list.push(row);
    grouped.set(row.model_id, list);
  }

  return grouped;
}

/** The hero image, or the first gallery shot when there isn't one. */
export function primaryImage(rows: MediaRow[] | undefined) {
  if (!rows?.length) return null;

  const main = rows.find((row) => row.collection_name === MAIN_IMAGE_COLLECTION);
  const fallback = rows.find((row) => row.collection_name === GALLERY_COLLECTION);
  const chosen = main ?? fallback;

  return chosen ? toMediaPayload(chosen) : null;
}
