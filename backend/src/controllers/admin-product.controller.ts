import type { Request, Response } from "express";
import { z } from "zod";

import { Prisma } from "../generated/prisma/client";
import {
  adminProductInclude,
  availableQty,
  money,
  type AdminProductWithRelations,
} from "../lib/catalog";
import { HttpError } from "../lib/http-error";
import { deleteMediaFiles } from "../lib/storage";
import {
  GALLERY_COLLECTION,
  MAIN_IMAGE_COLLECTION,
  PRODUCT_MODEL_TYPE,
  createMediaRows,
  fileIdsOf,
  mediaSelect,
  toMediaPayload,
  type UploadedFile,
} from "../lib/media";
import { prisma } from "../lib/prisma";
import { imagesByProduct } from "../lib/product-images";
import { cleanRichText } from "../lib/sanitize";
import { applyStockChange } from "../lib/stock";
import {
  MAX_GALLERY_IMAGES,
  listAdminProductsSchema,
  updateProductSchema,
  type ProductSort,
} from "../schemas/product.schema";

function adminId(req: Request): number {
  if (!req.auth) throw new HttpError(401, "Authentication required");
  return req.auth.userId;
}

function numericParam(value: unknown): number {
  return typeof value === "string" && value !== "" ? Number(value) : Number.NaN;
}

/**
 * Unlike the public listing, this shows drafts. The one thing it must never do
 * is leak into the shop — hence a separate fragment rather than a flag on
 * `VISIBLE` in product.controller.ts.
 */
const ADMIN_VISIBLE = Prisma.sql`p.deleted_at IS NULL`;

const ORDER_BY: Record<ProductSort, Prisma.Sql> = {
  newest: Prisma.sql`p.created_at DESC NULLS LAST, p.id DESC`,
  oldest: Prisma.sql`p.created_at ASC NULLS LAST, p.id ASC`,
  name_asc: Prisma.sql`p.product_name ASC`,
  name_desc: Prisma.sql`p.product_name DESC`,
  price_asc: Prisma.sql`MIN(pr.sale_price) ASC NULLS LAST, p.id DESC`,
  price_desc: Prisma.sql`MIN(pr.sale_price) DESC NULLS LAST, p.id DESC`,
  featured: Prisma.sql`p.is_featured DESC, p.order_by ASC NULLS LAST, p.id DESC`,
};

/** The default (and, for now, only) variant a simple product carries. */
function defaultVariantOf(product: AdminProductWithRelations) {
  return product.variants[0] ?? null;
}

function toAdminPayload(
  product: AdminProductWithRelations,
  media: Awaited<ReturnType<typeof imagesByProduct>>
) {
  const rows = media.get(product.id) ?? [];
  const main = rows.find((row) => row.collection_name === MAIN_IMAGE_COLLECTION);
  const gallery = rows.filter((row) => row.collection_name === GALLERY_COLLECTION);
  const variant = defaultVariantOf(product);

  return {
    id: product.id,
    product_code: product.product_code,
    slug: product.slug,
    product_name: product.product_name,
    short_description: product.short_description,
    description: product.description,
    how_to_use: product.how_to_use,
    specific_item_info: product.specific_item_info,
    meta_title: product.meta_title,
    meta_description: product.meta_description,
    brand: product.brand,
    category: product.category,
    product_type: product.product_type,
    status: product.status,
    is_featured: product.is_featured,
    is_combo: product.is_combo,
    badge_style: product.badge_style,
    order_by: product.order_by ?? 0,
    /**
     * Read from ProductPrice, not Product.tax_rate — the price column is what
     * checkout actually divides by, so it's the one that must round-trip.
     */
    tax_rate: variant?.price ? Number(variant.price.tax_percentage) : 0,
    variant: variant
      ? {
          id: variant.id,
          sku: variant.sku,
          variation_name: variant.variation_name,
          mrp: money(variant.price?.mrp),
          sale_price: money(variant.price?.sale_price),
          discount: money(variant.price?.discount),
          stock_qty: variant.inventory?.stock_qty ?? 0,
          reserved_qty: variant.inventory?.reserved_qty ?? 0,
          available_qty: availableQty(variant),
          low_stock_alert: variant.inventory?.low_stock_alert ?? 0,
        }
      : null,
    variant_count: product.variants.length,
    main_image: main ? toMediaPayload(main) : null,
    gallery: gallery.map(toMediaPayload),
    created_at: product.created_at,
    /** The editor sends this back so a stale save can be caught. */
    updated_at: product.updated_at,
  };
}

/** GET /admin/products — includes drafts, unlike the public catalogue. */
export async function listAdminProducts(req: Request, res: Response) {
  const query = listAdminProductsSchema.parse(req.query);

  const filters: Prisma.Sql[] = [ADMIN_VISIBLE];

  if (query.status === "active") filters.push(Prisma.sql`p.status = 1`);
  if (query.status === "inactive") filters.push(Prisma.sql`p.status <> 1`);

  if (query.search) {
    const term = `%${query.search}%`;
    filters.push(
      Prisma.sql`(p.product_name ILIKE ${term} OR p.product_code ILIKE ${term})`
    );
  }

  if (query.category) {
    const asId = Number(query.category);
    filters.push(
      Number.isInteger(asId)
        ? Prisma.sql`p.category_id = ${asId}`
        : Prisma.sql`p.category_id IN (SELECT id FROM categories WHERE slug = ${query.category})`
    );
  }

  if (query.brand) {
    const asId = Number(query.brand);
    filters.push(
      Number.isInteger(asId)
        ? Prisma.sql`p.brand_id = ${asId}`
        : Prisma.sql`p.brand_id IN (SELECT id FROM brands WHERE slug = ${query.brand})`
    );
  }

  if (query.featured !== undefined) {
    filters.push(Prisma.sql`p.is_featured = ${query.featured}`);
  }

  const where = Prisma.join(filters, " AND ");
  const offset = (query.page - 1) * query.limit;

  const [totals, ordered, counts] = await Promise.all([
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM products p WHERE ${where}
    `,
    // The variant join drops `v.status = 1` so a draft's price still sorts.
    prisma.$queryRaw<{ id: number }[]>`
      SELECT p.id
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id AND v.deleted_at IS NULL
      LEFT JOIN product_prices pr ON pr.variant_id = v.id
      WHERE ${where}
      GROUP BY p.id
      ORDER BY ${ORDER_BY[query.sort]}
      LIMIT ${query.limit} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ active: number; inactive: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE p.status = 1)::int AS active,
        COUNT(*) FILTER (WHERE p.status <> 1)::int AS inactive
      FROM products p
      WHERE p.deleted_at IS NULL
    `,
  ]);

  const total = totals[0]?.count ?? 0;
  const ids = ordered.map((row) => row.id);

  const [products, media] = await Promise.all([
    ids.length
      ? prisma.product.findMany({ where: { id: { in: ids } }, include: adminProductInclude })
      : Promise.resolve([]),
    imagesByProduct(ids),
  ]);

  // `IN (...)` loses the ordering the SQL step established — restore it.
  const byId = new Map(products.map((product) => [product.id, product]));
  const payload = ids
    .map((id) => byId.get(id))
    .filter((product): product is AdminProductWithRelations => Boolean(product))
    .map((product) => toAdminPayload(product, media));

  return res.status(200).json({
    products: payload,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.limit)),
      has_more: offset + payload.length < total,
    },
    summary: {
      active: counts[0]?.active ?? 0,
      inactive: counts[0]?.inactive ?? 0,
    },
    applied: {
      search: query.search ?? null,
      status: query.status,
      sort: query.sort,
    },
  });
}

async function loadAdminProduct(id: number) {
  const product = await prisma.product.findFirst({
    where: { id, deleted_at: null },
    include: adminProductInclude,
  });

  if (!product) throw new HttpError(404, "Product not found");

  const media = await imagesByProduct([product.id]);
  return toAdminPayload(product, media);
}

/** GET /admin/products/:id */
export async function getAdminProduct(req: Request, res: Response) {
  adminId(req);
  const id = numericParam(req.params["id"]);

  if (!Number.isInteger(id)) throw new HttpError(400, "Product id must be a number");

  return res.status(200).json({ product: await loadAdminProduct(id) });
}

/** Rejects a taxonomy reference that doesn't exist, rather than a raw FK error. */
async function assertTaxonomy(field: "category_id" | "brand_id", id: number | null) {
  if (id === null) return;

  const found =
    field === "category_id"
      ? await prisma.category.findFirst({ where: { id, deleted_at: null }, select: { id: true } })
      : await prisma.brand.findFirst({ where: { id, deleted_at: null }, select: { id: true } });

  if (!found) {
    throw new HttpError(422, "Validation failed", {
      [field]: [field === "category_id" ? "Category not found" : "Brand not found"],
    });
  }
}

/**
 * PATCH /admin/products/:id — admin only.
 *
 * Images arrive as deltas rather than a whole set, so an untouched gallery
 * costs nothing and a partial save can't wipe photos. Stock goes through the
 * shared ledger helper so an edit here is indistinguishable from one made on
 * the inventory screen.
 */
export async function updateProduct(req: Request, res: Response) {
  const admin = adminId(req);
  const id = numericParam(req.params["id"]);

  if (!Number.isInteger(id)) throw new HttpError(400, "Product id must be a number");

  const parsed = updateProductSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const input = parsed.data;
  const inbound: UploadedFile[] = [
    ...(input.main_image ? [input.main_image] : []),
    ...input.gallery_add,
  ];

  /** Anything uploaded for a save that never happened is an orphan. */
  async function discardInbound() {
    if (inbound.length) await deleteMediaFiles(inbound.map((file) => file.file_id));
  }


  const existing = await prisma.product.findFirst({
    where: { id, deleted_at: null },
    select: { id: true, product_code: true, updated_at: true },
  });

  if (!existing) {
    await discardInbound();
    throw new HttpError(404, "Product not found");
  }

  // Optimistic concurrency: two admins with the modal open would otherwise be
  // silent last-writer-wins across both rich-text bodies.
  if (
    input.expected_updated_at &&
    existing.updated_at &&
    new Date(input.expected_updated_at).getTime() !== existing.updated_at.getTime()
  ) {
    await discardInbound();
    throw new HttpError(
      409,
      "Someone else changed this product while you had it open. Close and reopen it to see their changes."
    );
  }

  try {
    if (input.category_id !== undefined) await assertTaxonomy("category_id", input.category_id);
    if (input.brand_id !== undefined) await assertTaxonomy("brand_id", input.brand_id);
  } catch (error) {
    await discardInbound();
    throw error;
  }

  const variants = await prisma.productVariant.findMany({
    where: { product_id: id, deleted_at: null },
    orderBy: { id: "asc" },
    include: { price: true, inventory: true },
  });

  const variant = variants[0];
  const touchesVariant =
    input.sku !== undefined ||
    input.mrp !== undefined ||
    input.sale_price !== undefined ||
    input.stock_qty !== undefined ||
    input.low_stock_alert !== undefined ||
    input.tax_rate !== undefined;

  // This dialog only knows how to edit one variant. Silently rewriting the
  // first of several would be worse than refusing.
  if (touchesVariant && variants.length > 1) {
    await discardInbound();
    throw new HttpError(
      409,
      "This product has more than one variant. Edit its pricing and stock from Inventory."
    );
  }

  if (touchesVariant && !variant) {
    await discardInbound();
    throw new HttpError(409, "This product has no variant to price.");
  }

  const nextMrp = input.mrp ?? money(variant?.price?.mrp) ?? 0;
  const nextSale = input.sale_price ?? money(variant?.price?.sale_price) ?? 0;

  if (nextMrp > 0 && nextSale > nextMrp) {
    await discardInbound();
    throw new HttpError(422, "Validation failed", {
      sale_price: ["Sale price can't be higher than MRP"],
    });
  }

  if (input.sku !== undefined && variant && input.sku !== variant.sku) {
    const clash = await prisma.productVariant.findFirst({
      where: { sku: input.sku, NOT: { id: variant.id } },
      select: { id: true },
    });

    if (clash) {
      await discardInbound();
      throw new HttpError(422, "Validation failed", {
        sku: ["Already used by another product"],
      });
    }
  }

  // Media ids come from the client, so they must be resolved within *this*
  // product or an admin could delete any media row in the system by id.
  const galleryRows = await prisma.media.findMany({
    where: {
      model_type: PRODUCT_MODEL_TYPE,
      model_id: id,
      collection_name: GALLERY_COLLECTION,
    },
    select: { ...mediaSelect, id: true },
    orderBy: [{ order_column: "asc" }, { id: "asc" }],
  });

  const removedGallery = galleryRows.filter((row) => input.gallery_remove.includes(row.id));

  if (removedGallery.length !== input.gallery_remove.length) {
    await discardInbound();
    throw new HttpError(404, "One of those images isn't on this product");
  }

  const replacedMain =
    input.main_image || input.remove_main_image
      ? await prisma.media.findMany({
          where: {
            model_type: PRODUCT_MODEL_TYPE,
            model_id: id,
            collection_name: MAIN_IMAGE_COLLECTION,
          },
          select: { ...mediaSelect, id: true },
        })
      : [];

  // Subtract the removals: "swap 3 for 3" on a full gallery is legitimate.
  const galleryAfter =
    galleryRows.length - removedGallery.length + input.gallery_add.length;

  if (galleryAfter > MAX_GALLERY_IMAGES) {
    await discardInbound();
    throw new HttpError(422, "Validation failed", {
      gallery: [`A product can have at most ${MAX_GALLERY_IMAGES} gallery images`],
    });
  }

  const lastPosition = galleryRows[galleryRows.length - 1]?.order_column ?? 0;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(input.product_name !== undefined ? { product_name: input.product_name } : {}),
          ...(input.short_description !== undefined
            ? { short_description: input.short_description || null }
            : {}),
          ...(input.description !== undefined
            ? { description: cleanRichText(input.description) }
            : {}),
          ...(input.how_to_use !== undefined
            ? { how_to_use: cleanRichText(input.how_to_use) }
            : {}),
          ...(input.specific_item_info !== undefined
            ? { specific_item_info: cleanRichText(input.specific_item_info) }
            : {}),
          ...(input.meta_title !== undefined ? { meta_title: input.meta_title || null } : {}),
          ...(input.meta_description !== undefined
            ? { meta_description: input.meta_description || null }
            : {}),
          ...(input.category_id !== undefined ? { category_id: input.category_id } : {}),
          ...(input.brand_id !== undefined ? { brand_id: input.brand_id } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.is_featured !== undefined ? { is_featured: input.is_featured } : {}),
          ...(input.is_combo !== undefined ? { is_combo: input.is_combo } : {}),
          ...(input.badge_style !== undefined
            ? { badge_style: input.badge_style === "none" ? null : input.badge_style }
            : {}),
          ...(input.order_by !== undefined ? { order_by: input.order_by } : {}),
          // Mirror of ProductPrice.tax_percentage, which is authoritative.
          ...(input.tax_rate !== undefined
            ? { tax_rate: new Prisma.Decimal(input.tax_rate) }
            : {}),
          updated_by_id: admin,
        },
      });

      if (variant) {
        if (input.sku !== undefined && input.sku !== variant.sku) {
          await tx.productVariant.update({ where: { id: variant.id }, data: { sku: input.sku } });
        }

        if (
          input.mrp !== undefined ||
          input.sale_price !== undefined ||
          input.tax_rate !== undefined
        ) {
          const taxPercentage =
            input.tax_rate ?? Number(variant.price?.tax_percentage ?? 0);

          await tx.productPrice.upsert({
            where: { variant_id: variant.id },
            update: {
              mrp: new Prisma.Decimal(nextMrp || nextSale),
              sale_price: new Prisma.Decimal(nextSale),
              discount: new Prisma.Decimal(Math.max(0, (nextMrp || 0) - nextSale)),
              tax_percentage: new Prisma.Decimal(taxPercentage),
            },
            create: {
              variant_id: variant.id,
              mrp: new Prisma.Decimal(nextMrp || nextSale),
              sale_price: new Prisma.Decimal(nextSale),
              discount: new Prisma.Decimal(Math.max(0, (nextMrp || 0) - nextSale)),
              tax_percentage: new Prisma.Decimal(taxPercentage),
            },
          });
        }

        if (input.low_stock_alert !== undefined) {
          // A threshold, not a count — no ledger entry.
          await tx.productInventory.upsert({
            where: { variant_id: variant.id },
            update: { low_stock_alert: input.low_stock_alert },
            create: {
              variant_id: variant.id,
              stock_qty: 0,
              reserved_qty: 0,
              low_stock_alert: input.low_stock_alert,
            },
          });
        }

        // Only when it actually moved, or saving an unrelated field would spam
        // the ledger with no-op rows.
        if (
          input.stock_qty !== undefined &&
          input.stock_qty !== (variant.inventory?.stock_qty ?? 0)
        ) {
          await applyStockChange(tx, {
            variantId: variant.id,
            productId: id,
            mode: "set",
            quantity: input.stock_qty,
            actorId: admin,
            notes: "Set from product edit",
          });
        }
      }

      const staleIds = [...replacedMain, ...removedGallery].map((row) => row.id);
      if (staleIds.length) {
        await tx.media.deleteMany({ where: { id: { in: staleIds } } });
      }

      if (input.main_image) {
        await createMediaRows(tx, {
          modelType: PRODUCT_MODEL_TYPE,
          modelId: id,
          collection: MAIN_IMAGE_COLLECTION,
          files: [input.main_image],
        });
      }

      if (input.gallery_add.length) {
        await createMediaRows(tx, {
          modelType: PRODUCT_MODEL_TYPE,
          modelId: id,
          collection: GALLERY_COLLECTION,
          files: input.gallery_add,
          startAt: lastPosition,
        });
      }
    });
  } catch (error) {
    await discardInbound();

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = String((error.meta as { target?: unknown })?.target ?? "");
      const field = target.includes("sku")
        ? "sku"
        : target.includes("slug")
          ? "slug"
          : "product_code";
      throw new HttpError(409, "That value is already in use", { [field]: ["Already in use"] });
    }

    throw error;
  }

  // Rows first, files second: an orphaned file is recoverable, a broken image
  // on the site is what customers would see.
  const orphaned = fileIdsOf([...replacedMain, ...removedGallery]);
  if (orphaned.length) await deleteMediaFiles(orphaned);

  return res.status(200).json({ product: await loadAdminProduct(id) });
}
