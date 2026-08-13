import type { Request, Response } from "express";
import { z } from "zod";

import { LIVE_PRODUCT, productInclude, toProductCard } from "../lib/catalog";
import { HttpError } from "../lib/http-error";
import { imagesByProduct } from "../lib/product-images";
import { prisma } from "../lib/prisma";
import { wishlistSchema } from "../schemas/cart.schema";

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, "Authentication required");
  return req.auth.userId;
}

async function loadWishlist(user: number) {
  const rows = await prisma.wishlist.findMany({
    where: { user_id: user },
    include: { product: { include: productInclude } },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });

  // A product pulled from the catalogue shouldn't keep showing up as a card.
  const live = rows.filter((row) => row.product.deleted_at === null && row.product.status === 1);
  const images = await imagesByProduct(live.map((row) => row.product_id));

  return {
    items: live.map((row) => ({
      id: row.id,
      product: toProductCard(row.product, images.get(row.product_id)),
      added_at: row.created_at,
    })),
    // Lets the client mark hearts without walking the item list.
    product_ids: live.map((row) => row.product_id),
    count: live.length,
  };
}

/** GET /wishlist */
export async function getWishlist(req: Request, res: Response) {
  return res.status(200).json(await loadWishlist(userId(req)));
}

/**
 * POST /wishlist — idempotent. Saving something twice is a double-click, not an
 * error, so it succeeds either way. The table has no unique constraint (its
 * nullable user_id would make one useless for guests), hence the explicit check.
 */
export async function addToWishlist(req: Request, res: Response) {
  const user = userId(req);
  const parsed = wishlistSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.product_id, ...LIVE_PRODUCT },
    select: { id: true },
  });

  if (!product) throw new HttpError(404, "Product not found");

  const existing = await prisma.wishlist.findFirst({
    where: { user_id: user, product_id: product.id },
    select: { id: true },
  });

  if (!existing) {
    await prisma.wishlist.create({ data: { user_id: user, product_id: product.id } });
  }

  return res.status(existing ? 200 : 201).json(await loadWishlist(user));
}

/** DELETE /wishlist/:productId */
export async function removeFromWishlist(req: Request, res: Response) {
  const user = userId(req);
  const raw = req.params["productId"];
  const productId = typeof raw === "string" && raw !== "" ? Number(raw) : Number.NaN;

  if (!Number.isInteger(productId)) {
    throw new HttpError(400, "Product id must be a number");
  }

  // deleteMany rather than delete: removing something already gone is fine.
  await prisma.wishlist.deleteMany({ where: { user_id: user, product_id: productId } });

  return res.status(200).json(await loadWishlist(user));
}
