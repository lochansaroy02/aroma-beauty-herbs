import { Prisma } from "../generated/prisma/client";
import type { MediaRow } from "./media";
import { primaryImage } from "./product-images";

/** Only live, in-catalogue rows are ever exposed to shoppers. */
export const LIVE_PRODUCT = { deleted_at: null, status: 1 } as const;
export const LIVE_VARIANT = { deleted_at: null, status: 1 } as const;

export const productInclude = {
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    where: LIVE_VARIANT,
    select: {
      id: true,
      sku: true,
      variation_name: true,
      price: {
        select: { mrp: true, sale_price: true, discount: true, tax_percentage: true },
      },
      inventory: { select: { stock_qty: true, reserved_qty: true } },
    },
  },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

/**
 * The admin view of a product. Deliberately a second const rather than a
 * parameter on `productInclude` — the public listing, cart, wishlist and
 * checkout all rely on that one hiding inactive variants, and widening it would
 * quietly leak drafts into the shop.
 *
 * Only adds fields, so anything typed against `ProductWithRelations` accepts
 * one of these unchanged.
 */
export const adminProductInclude = {
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    where: { deleted_at: null },
    orderBy: { id: "asc" },
    select: {
      id: true,
      sku: true,
      variation_name: true,
      status: true,
      price: {
        select: { mrp: true, sale_price: true, discount: true, tax_percentage: true },
      },
      inventory: {
        select: { stock_qty: true, reserved_qty: true, low_stock_alert: true },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export type AdminProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof adminProductInclude;
}>;

export type VariantWithPrice = ProductWithRelations["variants"][number];

export function money(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Stock that isn't already spoken for by a pending order. */
export function availableQty(variant: {
  inventory: { stock_qty: number; reserved_qty: number } | null;
}): number {
  return Math.max(
    0,
    (variant.inventory?.stock_qty ?? 0) - (variant.inventory?.reserved_qty ?? 0)
  );
}

/** Cheapest active variant drives the listing price, as shoppers expect. */
export function cheapestVariant(product: ProductWithRelations): VariantWithPrice | null {
  const priced = product.variants.filter((variant) => variant.price);
  if (!priced.length) return product.variants[0] ?? null;

  return priced.reduce((best, current) =>
    Number(current.price!.sale_price) < Number(best.price!.sale_price) ? current : best
  );
}

export function priceSummary(product: ProductWithRelations) {
  const priced = product.variants.filter((variant) => variant.price);
  if (!priced.length) return null;

  const cheapest = cheapestVariant(product)!;

  return {
    mrp: money(cheapest.price!.mrp),
    sale_price: money(cheapest.price!.sale_price),
    discount: money(cheapest.price!.discount),
    tax_percentage: money(cheapest.price!.tax_percentage),
    currency: "INR",
    from: priced.length > 1,
  };
}

export function inStock(product: ProductWithRelations): boolean {
  return product.variants.some((variant) => availableQty(variant) > 0);
}

/**
 * The compact shape cart and wishlist rows carry — enough to render a line item
 * or a card without a second round trip for the product.
 */
export function toProductCard(product: ProductWithRelations, images: MediaRow[] | undefined) {
  return {
    id: product.id,
    product_name: product.product_name,
    slug: product.slug,
    product_code: product.product_code,
    short_description: product.short_description,
    brand: product.brand,
    category: product.category,
    price: priceSummary(product),
    in_stock: inStock(product),
    image: primaryImage(images),
  };
}
