import type { Request, Response } from "express";
import { z } from "zod";

import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { applyStockChange } from "../lib/stock";
import {
  adjustStockSchema,
  listInventorySchema,
  lowStockAlertSchema,
  type InventoryFilter,
  type InventorySort,
} from "../schemas/inventory.schema";

function adminId(req: Request): number {
  if (!req.auth) throw new HttpError(401, "Authentication required");
  return req.auth.userId;
}

/**
 * Stock lives on the variant, not the product — a 50ml and a 100ml bottle are
 * counted separately. Most products have one "Default" variant, so the listing
 * reads as one row per product until real variants exist.
 */
const variantSelect = {
  id: true,
  sku: true,
  variation_name: true,
  status: true,
  product: {
    select: { id: true, product_name: true, slug: true, status: true, deleted_at: true },
  },
  inventory: {
    select: {
      stock_qty: true,
      reserved_qty: true,
      low_stock_alert: true,
      updated_at: true,
    },
  },
  price: { select: { sale_price: true } },
} satisfies Prisma.ProductVariantSelect;

type VariantRow = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;

export type StockState = "out" | "low" | "ok";

/**
 * `available` is what a shopper can actually buy: stock the warehouse holds,
 * minus what's already promised to unpaid orders.
 */
function stockState(available: number, threshold: number): StockState {
  if (available <= 0) return "out";
  // A threshold of 0 disables the alert rather than firing it constantly.
  if (threshold > 0 && available <= threshold) return "low";
  return "ok";
}

function toInventoryRow(variant: VariantRow) {
  const stock = variant.inventory?.stock_qty ?? 0;
  const reserved = variant.inventory?.reserved_qty ?? 0;
  const threshold = variant.inventory?.low_stock_alert ?? 0;
  const available = Math.max(0, stock - reserved);

  return {
    variant_id: variant.id,
    sku: variant.sku,
    variation_name: variant.variation_name,
    product: {
      id: variant.product.id,
      product_name: variant.product.product_name,
      slug: variant.product.slug,
    },
    stock_qty: stock,
    reserved_qty: reserved,
    available_qty: available,
    low_stock_alert: threshold,
    state: stockState(available, threshold),
    /** True when a stock count has been recorded as lower than what's promised. */
    oversold: reserved > stock,
    sale_price: variant.price ? Number(variant.price.sale_price) : null,
    updated_at: variant.inventory?.updated_at ?? null,
    /** No inventory row yet — treated as zero, created on first adjustment. */
    tracked: variant.inventory !== null,
  };
}

/**
 * Low/out can't be expressed in a Prisma `where` (they compare two columns), so
 * the ids are resolved in SQL first and Prisma hydrates them. Same shape as the
 * product listing's price sort, for the same reason.
 */
const FILTER_SQL: Record<InventoryFilter, Prisma.Sql> = {
  all: Prisma.sql`TRUE`,
  out: Prisma.sql`GREATEST(0, COALESCE(i.stock_qty, 0) - COALESCE(i.reserved_qty, 0)) <= 0`,
  low: Prisma.sql`
    COALESCE(i.low_stock_alert, 0) > 0
    AND GREATEST(0, COALESCE(i.stock_qty, 0) - COALESCE(i.reserved_qty, 0)) > 0
    AND GREATEST(0, COALESCE(i.stock_qty, 0) - COALESCE(i.reserved_qty, 0)) <= i.low_stock_alert
  `,
  in_stock: Prisma.sql`GREATEST(0, COALESCE(i.stock_qty, 0) - COALESCE(i.reserved_qty, 0)) > 0`,
};

const SORT_SQL: Record<InventorySort, Prisma.Sql> = {
  stock_asc: Prisma.sql`COALESCE(i.stock_qty, 0) ASC, v.id ASC`,
  stock_desc: Prisma.sql`COALESCE(i.stock_qty, 0) DESC, v.id ASC`,
  name_asc: Prisma.sql`p.product_name ASC, v.id ASC`,
  name_desc: Prisma.sql`p.product_name DESC, v.id ASC`,
  updated: Prisma.sql`i.updated_at DESC NULLS LAST, v.id DESC`,
};

/** GET /admin/inventory */
export async function listInventory(req: Request, res: Response) {
  const query = listInventorySchema.parse(req.query);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`v.deleted_at IS NULL AND p.deleted_at IS NULL`,
    FILTER_SQL[query.filter],
  ];

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(Prisma.sql`(p.product_name ILIKE ${term} OR v.sku ILIKE ${term})`);
  }

  const where = Prisma.join(conditions, " AND ");
  const offset = (query.page - 1) * query.limit;

  const [totals, ordered, summary] = await Promise.all([
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN product_inventory i ON i.variant_id = v.id
      WHERE ${where}
    `,
    prisma.$queryRaw<{ id: number }[]>`
      SELECT v.id
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN product_inventory i ON i.variant_id = v.id
      WHERE ${where}
      ORDER BY ${SORT_SQL[query.sort]}
      LIMIT ${query.limit} OFFSET ${offset}
    `,
    // Headline counts cover the whole catalogue, not the current page.
    prisma.$queryRaw<{ low: number; out: number; tracked: number; units: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE ${FILTER_SQL.low})::int AS low,
        COUNT(*) FILTER (WHERE ${FILTER_SQL.out})::int AS out,
        COUNT(*)::int AS tracked,
        COALESCE(SUM(COALESCE(i.stock_qty, 0)), 0)::int AS units
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN product_inventory i ON i.variant_id = v.id
      WHERE v.deleted_at IS NULL AND p.deleted_at IS NULL
    `,
  ]);

  const total = totals[0]?.count ?? 0;
  const ids = ordered.map((row) => row.id);

  const variants = ids.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: ids } },
        select: variantSelect,
      })
    : [];

  // `IN (...)` loses the ordering the SQL step established — restore it.
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const rows = ids
    .map((id) => byId.get(id))
    .filter((variant): variant is VariantRow => Boolean(variant))
    .map(toInventoryRow);

  return res.status(200).json({
    items: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.limit)),
      has_more: offset + rows.length < total,
    },
    summary: {
      low_stock: summary[0]?.low ?? 0,
      out_of_stock: summary[0]?.out ?? 0,
      tracked_variants: summary[0]?.tracked ?? 0,
      total_units: summary[0]?.units ?? 0,
    },
    applied: {
      search: query.search ?? null,
      filter: query.filter,
      sort: query.sort,
    },
  });
}

function numericParam(value: unknown): number {
  return typeof value === "string" && value !== "" ? Number(value) : Number.NaN;
}

async function findVariant(req: Request) {
  const id = numericParam(req.params["variantId"]);
  if (!Number.isInteger(id)) throw new HttpError(400, "Variant id must be a number");

  const variant = await prisma.productVariant.findFirst({
    where: { id, deleted_at: null },
    select: { id: true, product_id: true, sku: true },
  });

  if (!variant) throw new HttpError(404, "Variant not found");
  return variant;
}

/**
 * POST /admin/inventory/:variantId/adjust
 *
 * The counting, locking and ledger write live in lib/stock.ts so the product
 * editor can make the same change inside its own transaction.
 */
export async function adjustStock(req: Request, res: Response) {
  const admin = adminId(req);
  const parsed = adjustStockSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const variant = await findVariant(req);
  const { mode, quantity, reason } = parsed.data;

  const result = await prisma.$transaction((tx) =>
    applyStockChange(tx, {
      variantId: variant.id,
      productId: variant.product_id,
      mode,
      quantity,
      actorId: admin,
      notes: reason ?? `Stock ${mode} by staff`,
    })
  );

  const refreshed = await prisma.productVariant.findUniqueOrThrow({
    where: { id: variant.id },
    select: variantSelect,
  });

  return res.status(200).json({
    item: toInventoryRow(refreshed),
    change: { before: result.before, after: result.after },
    // Not an error — the manager counted what they counted — but they should
    // know that orders are already promised more than the shelf holds.
    ...(result.after < result.reserved
      ? {
          warning: `${result.reserved} unit(s) are reserved for unpaid orders but stock is now ${result.after}.`,
        }
      : {}),
  });
}

/** PATCH /admin/inventory/:variantId/alert — the low-stock threshold. */
export async function updateLowStockAlert(req: Request, res: Response) {
  const parsed = lowStockAlertSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const variant = await findVariant(req);

  await prisma.productInventory.upsert({
    where: { variant_id: variant.id },
    update: { low_stock_alert: parsed.data.low_stock_alert },
    create: {
      variant_id: variant.id,
      stock_qty: 0,
      reserved_qty: 0,
      low_stock_alert: parsed.data.low_stock_alert,
    },
  });

  const refreshed = await prisma.productVariant.findUniqueOrThrow({
    where: { id: variant.id },
    select: variantSelect,
  });

  return res.status(200).json({ item: toInventoryRow(refreshed) });
}

/** GET /admin/inventory/:variantId/history — the stock ledger for one variant. */
export async function getStockHistory(req: Request, res: Response) {
  const variant = await findVariant(req);

  const transactions = await prisma.stockTransaction.findMany({
    where: { variant_id: variant.id },
    orderBy: { id: "desc" },
    take: 50,
  });

  const actorIds = [
    ...new Set(
      transactions
        .map((entry) => entry.created_by_id)
        .filter((id): id is number => id !== null)
    ),
  ];

  // created_by_id is an audit column with no relation, so names are looked up.
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const byId = new Map(actors.map((actor) => [actor.id, actor]));

  return res.status(200).json({
    history: transactions.map((entry) => {
      const actor = entry.created_by_id ? byId.get(entry.created_by_id) : undefined;

      return {
        id: entry.id,
        type: entry.type,
        reference_type: entry.reference_type,
        reference_id: entry.reference_id,
        qty: Number(entry.qty),
        stock_before: Number(entry.stock_before),
        stock_after: Number(entry.stock_after),
        notes: entry.notes,
        by: actor?.name ?? actor?.email ?? null,
        at: entry.created_at,
      };
    }),
  });
}
