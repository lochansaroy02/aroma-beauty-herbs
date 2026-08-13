import type { Request, Response } from "express";
import { z } from "zod";

import { Prisma } from "../generated/prisma/client";
import {
  LIVE_PRODUCT,
  availableQty,
  cheapestVariant,
  money,
  productInclude,
  toProductCard,
  type ProductWithRelations,
  type VariantWithPrice,
} from "../lib/catalog";
import { HttpError } from "../lib/http-error";
import type { MediaRow } from "../lib/media";
import { imagesByProduct } from "../lib/product-images";
import { prisma } from "../lib/prisma";
import {
  MAX_LINE_QUANTITY,
  addToCartSchema,
  updateCartItemSchema,
} from "../schemas/cart.schema";

const cartItemInclude = {
  product: { include: productInclude },
  variant: {
    select: {
      id: true,
      sku: true,
      variation_name: true,
      status: true,
      deleted_at: true,
      price: {
        select: { mrp: true, sale_price: true, discount: true, tax_percentage: true },
      },
      inventory: { select: { stock_qty: true, reserved_qty: true } },
    },
  },
} satisfies Prisma.CartItemInclude;

type CartItemRow = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, "Authentication required");
  return req.auth.userId;
}

/**
 * The line price comes from the variant as it is *now*, not the snapshot taken
 * when it was added — a shopper should never be charged a stale price. The
 * snapshot is kept so the change can be pointed out.
 */
function livePrice(item: CartItemRow): number | null {
  const sale = item.variant?.price?.sale_price;
  if (sale !== undefined && sale !== null) return Number(sale);

  const fallback = cheapestVariant(item.product)?.price?.sale_price;
  return fallback === undefined || fallback === null ? null : Number(fallback);
}

function toCartItem(item: CartItemRow, images: Map<number, MediaRow[]>) {
  const unitPrice = livePrice(item);
  const snapshot = money(item.price ?? null);
  const available = item.variant ? availableQty(item.variant) : 0;

  return {
    id: item.id,
    quantity: item.quantity,
    unit_price: unitPrice,
    line_total: unitPrice === null ? null : Number((unitPrice * item.quantity).toFixed(2)),
    // Non-null only when the price moved since the item was added.
    price_at_add: snapshot,
    price_changed: snapshot !== null && unitPrice !== null && snapshot !== unitPrice,
    available_qty: available,
    /** True when the line can't be fulfilled as it stands. */
    unavailable: available < item.quantity,
    variant: item.variant
      ? {
          id: item.variant.id,
          sku: item.variant.sku,
          variation_name: item.variant.variation_name,
        }
      : null,
    product: toProductCard(item.product, images.get(item.product_id)),
    added_at: item.created_at,
  };
}

async function loadCart(user: number) {
  const items = await prisma.cartItem.findMany({
    where: { user_id: user },
    include: cartItemInclude,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });

  const images = await imagesByProduct(items.map((item) => item.product_id));
  const payload = items.map((item) => toCartItem(item, images));

  const subtotal = payload.reduce((sum, item) => sum + (item.line_total ?? 0), 0);

  return {
    items: payload,
    summary: {
      item_count: payload.length,
      total_quantity: payload.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: Number(subtotal.toFixed(2)),
      currency: "INR",
      // Delivery and tax are decided at checkout, which doesn't exist yet.
      has_unavailable: payload.some((item) => item.unavailable),
    },
  };
}

/**
 * Resolves which variant the line refers to. Products always get a default
 * variant on creation, so "no variant chosen" still has an obvious answer.
 */
function resolveVariant(
  product: ProductWithRelations,
  variantId: number | null
): VariantWithPrice {
  if (variantId === null) {
    const fallback = cheapestVariant(product);
    if (!fallback) {
      throw new HttpError(409, "This product isn't available to buy yet");
    }
    return fallback;
  }

  const chosen = product.variants.find((variant) => variant.id === variantId);
  if (!chosen) {
    throw new HttpError(422, "Validation failed", {
      variant_id: ["That option isn't available for this product"],
    });
  }

  return chosen;
}

async function findLiveProduct(productId: number): Promise<ProductWithRelations> {
  const product = await prisma.product.findFirst({
    where: { id: productId, ...LIVE_PRODUCT },
    include: productInclude,
  });

  if (!product) throw new HttpError(404, "Product not found");
  return product;
}

/** GET /cart */
export async function getCart(req: Request, res: Response) {
  return res.status(200).json(await loadCart(userId(req)));
}

/**
 * POST /cart — adds a product, or tops up the quantity if it's already there.
 * Rejects rather than silently clamping, so the shopper knows what happened.
 */
export async function addToCart(req: Request, res: Response) {
  const user = userId(req);
  const parsed = addToCartSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const { product_id, variant_id, quantity } = parsed.data;
  const product = await findLiveProduct(product_id);
  const variant = resolveVariant(product, variant_id);
  const available = availableQty(variant);

  const existing = await prisma.cartItem.findFirst({
    where: { user_id: user, product_id: product.id, product_variant_id: variant.id },
    select: { id: true, quantity: true },
  });

  const wanted = (existing?.quantity ?? 0) + quantity;

  if (available <= 0) {
    throw new HttpError(409, "That option is out of stock");
  }

  if (wanted > available) {
    throw new HttpError(
      409,
      existing
        ? `Only ${available} in stock, and you already have ${existing.quantity} in your cart`
        : `Only ${available} in stock`
    );
  }

  if (wanted > MAX_LINE_QUANTITY) {
    throw new HttpError(422, "Validation failed", {
      quantity: [`You can order at most ${MAX_LINE_QUANTITY} of one item`],
    });
  }

  const price = variant.price ? new Prisma.Decimal(variant.price.sale_price) : null;

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: wanted, price },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        user_id: user,
        product_id: product.id,
        product_variant_id: variant.id,
        quantity,
        price,
      },
    });
  }

  return res.status(existing ? 200 : 201).json(await loadCart(user));
}

async function findOwnedItem(user: number, idParam: unknown) {
  const itemId = typeof idParam === "string" && idParam !== "" ? Number(idParam) : Number.NaN;

  if (!Number.isInteger(itemId)) {
    throw new HttpError(400, "Cart item id must be a number");
  }

  // Scoped to the caller: an id from someone else's cart must read as missing.
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, user_id: user },
    include: { variant: { select: { inventory: true } } },
  });

  if (!item) throw new HttpError(404, "That item isn't in your cart");
  return item;
}

/** PATCH /cart/:id — sets an exact quantity. */
export async function updateCartItem(req: Request, res: Response) {
  const user = userId(req);
  const parsed = updateCartItemSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const item = await findOwnedItem(user, req.params["id"]);
  const available = item.variant ? availableQty(item.variant) : 0;

  if (parsed.data.quantity > available) {
    throw new HttpError(409, `Only ${available} in stock`);
  }

  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: parsed.data.quantity },
  });

  return res.status(200).json(await loadCart(user));
}

/** DELETE /cart/:id */
export async function removeCartItem(req: Request, res: Response) {
  const user = userId(req);
  const item = await findOwnedItem(user, req.params["id"]);

  await prisma.cartItem.delete({ where: { id: item.id } });

  return res.status(200).json(await loadCart(user));
}

/** DELETE /cart */
export async function clearCart(req: Request, res: Response) {
  const user = userId(req);
  await prisma.cartItem.deleteMany({ where: { user_id: user } });

  return res.status(200).json(await loadCart(user));
}
