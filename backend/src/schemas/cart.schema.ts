import { z } from "zod";

/** A cap that stops a typo becoming a 10,000-unit order. */
export const MAX_LINE_QUANTITY = 99;

const id = z.coerce.number().int().positive();

const quantity = z.coerce
  .number()
  .int()
  .min(1, "Quantity must be at least 1")
  .max(MAX_LINE_QUANTITY, `Quantity can be at most ${MAX_LINE_QUANTITY}`);

export const addToCartSchema = z.object({
  product_id: id,
  /** Omitted means "the default variant" — resolved server-side. */
  variant_id: id.nullish().transform((value) => value ?? null),
  quantity: quantity.optional().default(1),
});

export const updateCartItemSchema = z.object({
  quantity,
});

export const wishlistSchema = z.object({
  product_id: id,
});
