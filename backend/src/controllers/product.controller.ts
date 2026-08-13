import type { Request, Response } from "express";
import { z } from "zod";

import { Prisma } from "../generated/prisma/client";
import {
  adminProductInclude,
  availableQty,
  inStock,
  money,
  priceSummary,
  productInclude,
  type ProductWithRelations,
} from "../lib/catalog";
import { HttpError } from "../lib/http-error";
import { deleteMediaFiles } from "../lib/storage";
import {
  GALLERY_COLLECTION,
  MAIN_IMAGE_COLLECTION,
  PRODUCT_MODEL_TYPE,
  createMediaRows,
  fileIdsOf,
  toMediaPayload,
  type MediaRow,
  type UploadedFile,
} from "../lib/media";
import { prisma } from "../lib/prisma";
import { imagesByProduct } from "../lib/product-images";
import { cleanRichText } from "../lib/sanitize";
import { slugify, uniqueProductCode, uniqueSlug } from "../lib/slug";
import {
  MAX_GALLERY_IMAGES,
  attachImagesSchema,
  createProductSchema,
  listProductsSchema,
  type ProductSort,
} from "../schemas/product.schema";

/** Only live, in-catalogue products are ever exposed publicly. */
const VISIBLE = Prisma.sql`p.deleted_at IS NULL AND p.status = 1`;

function toProductPayload(product: ProductWithRelations, images: MediaRow[]) {
  const main = images.find((row) => row.collection_name === MAIN_IMAGE_COLLECTION);
  const gallery = images.filter((row) => row.collection_name === GALLERY_COLLECTION);
  const payloadImages = gallery.map(toMediaPayload);

  return {
    id: product.id,
    product_code: product.product_code,
    product_name: product.product_name,
    slug: product.slug,
    short_description: product.short_description,
    product_type: product.product_type,
    badge_style: product.badge_style,
    is_featured: product.is_featured,
    is_combo: product.is_combo,
    brand: product.brand,
    category: product.category,
    price: priceSummary(product),
    in_stock: inStock(product),
    variant_count: product.variants.length,
    // Falls back to the first gallery shot so a product without a hero image
    // still shows a thumbnail.
    primary_image: main ? toMediaPayload(main) : payloadImages[0] ?? null,
    images: payloadImages,
    created_at: product.created_at,
  };
}

/** Whitelisted, so these fragments can never carry caller input. */
const ORDER_BY: Record<ProductSort, Prisma.Sql> = {
  newest: Prisma.sql`p.created_at DESC NULLS LAST, p.id DESC`,
  oldest: Prisma.sql`p.created_at ASC NULLS LAST, p.id ASC`,
  name_asc: Prisma.sql`p.product_name ASC`,
  name_desc: Prisma.sql`p.product_name DESC`,
  price_asc: Prisma.sql`MIN(pr.sale_price) ASC NULLS LAST, p.id DESC`,
  price_desc: Prisma.sql`MIN(pr.sale_price) DESC NULLS LAST, p.id DESC`,
  featured: Prisma.sql`p.is_featured DESC, p.order_by ASC NULLS LAST, p.id DESC`,
};

/**
 * Ordering by price means aggregating across variants, which Prisma can't
 * express in `orderBy`. Resolving ids in SQL first keeps sorting and pagination
 * correct, then Prisma hydrates the rows.
 */
function buildFilters(query: {
  search?: string | undefined;
  category?: string | undefined;
  brand?: string | undefined;
  featured?: boolean | undefined;
}): Prisma.Sql[] {
  const filters: Prisma.Sql[] = [VISIBLE];

  if (query.search) {
    const term = `%${query.search}%`;
    filters.push(
      Prisma.sql`(p.product_name ILIKE ${term} OR p.product_code ILIKE ${term})`
    );
  }

  // Accept either a slug or a numeric id for category/brand.
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

  return filters;
}

/** GET /products */
export async function listProducts(req: Request, res: Response) {
  const query = listProductsSchema.parse(req.query);
  const filters = buildFilters(query);
  const where = Prisma.join(filters, " AND ");
  const offset = (query.page - 1) * query.limit;

  const [totals, ordered] = await Promise.all([
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM products p
      WHERE ${where}
    `,
    prisma.$queryRaw<{ id: number }[]>`
      SELECT p.id
      FROM products p
      LEFT JOIN product_variants v
        ON v.product_id = p.id AND v.deleted_at IS NULL AND v.status = 1
      LEFT JOIN product_prices pr ON pr.variant_id = v.id
      WHERE ${where}
      GROUP BY p.id
      ORDER BY ${ORDER_BY[query.sort]}
      LIMIT ${query.limit} OFFSET ${offset}
    `,
  ]);

  const total = totals[0]?.count ?? 0;
  const ids = ordered.map((row) => row.id);

  const [products, images] = await Promise.all([
    ids.length
      ? prisma.product.findMany({ where: { id: { in: ids } }, include: productInclude })
      : Promise.resolve([]),
    imagesByProduct(ids),
  ]);

  // `IN (...)` loses the ordering the SQL step established — restore it.
  const byId = new Map(products.map((product) => [product.id, product]));
  const payload = ids
    .map((id) => byId.get(id))
    .filter((product): product is ProductWithRelations => Boolean(product))
    .map((product) => toProductPayload(product, images.get(product.id) ?? []));

  return res.status(200).json({
    products: payload,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.limit)),
      has_more: offset + payload.length < total,
    },
    applied: {
      search: query.search ?? null,
      category: query.category ?? null,
      brand: query.brand ?? null,
      featured: query.featured ?? null,
      sort: query.sort,
    },
  });
}

/** Product images are media rows against the product's polymorphic key. */
function attachImages(
  tx: Prisma.TransactionClient,
  productId: number,
  collection: string,
  images: UploadedFile[],
  startAt = 0
) {
  return createMediaRows(tx, {
    modelType: PRODUCT_MODEL_TYPE,
    modelId: productId,
    collection,
    files: images,
    startAt,
  });
}

/**
 * POST /products — admin only.
 * Creates the product plus one default variant with price and inventory, so it
 * shows a price and stock state in the listing straight away.
 */
export async function createProduct(req: Request, res: Response) {
  const parsed = createProductSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const input = parsed.data;
  const uploaded = [...(input.main_image ? [input.main_image] : []), ...input.gallery];


  // Reject references to taxonomy rows that don't exist, rather than letting
  // the foreign key fail with an opaque error.
  if (input.category_id !== null) {
    const category = await prisma.category.findFirst({
      where: { id: input.category_id, deleted_at: null },
      select: { id: true },
    });
    if (!category) {
      throw new HttpError(422, "Validation failed", { category_id: ["Category not found"] });
    }
  }

  if (input.brand_id !== null) {
    const brand = await prisma.brand.findFirst({
      where: { id: input.brand_id, deleted_at: null },
      select: { id: true },
    });
    if (!brand) {
      throw new HttpError(422, "Validation failed", { brand_id: ["Brand not found"] });
    }
  }

  if (input.mrp && input.sale_price > input.mrp) {
    throw new HttpError(422, "Validation failed", {
      sale_price: ["Sale price can't be higher than MRP"],
    });
  }

  const slug = input.slug ? await uniqueSlug(input.slug) : await uniqueSlug(slugify(input.product_name));
  const productCode = input.product_code
    ? await uniqueProductCode(input.product_code)
    : await uniqueProductCode(input.product_name.replace(/\s+/g, ""));

  const discount = Math.max(0, (input.mrp || 0) - input.sale_price);
  const sku = input.sku ?? `${productCode}-A`;

  // A hand-typed SKU can collide with a generated one from another product.
  if (input.sku) {
    const clash = await prisma.productVariant.findFirst({
      where: { sku: input.sku },
      select: { id: true },
    });

    if (clash) {
      await deleteMediaFiles(uploaded.map((image) => image.file_id));
      throw new HttpError(422, "Validation failed", {
        sku: ["Already used by another product"],
      });
    }
  }

  try {
    const { product, images } = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          product_name: input.product_name,
          slug,
          product_code: productCode,
          short_description: input.short_description || null,
          description: cleanRichText(input.description),
          how_to_use: cleanRichText(input.how_to_use),
          specific_item_info: cleanRichText(input.specific_item_info),
          meta_title: input.meta_title || null,
          meta_description: input.meta_description || null,
          category_id: input.category_id,
          brand_id: input.brand_id,
          is_featured: input.is_featured,
          is_combo: input.is_combo,
          badge_style: input.badge_style === "none" ? null : input.badge_style,
          order_by: input.order_by,
          // Mirror of ProductPrice.tax_percentage, which is authoritative.
          tax_rate: new Prisma.Decimal(input.tax_rate),
          status: input.status,
          created_by_id: req.auth?.userId ?? null,
        },
      });

      const variant = await tx.productVariant.create({
        data: { product_id: created.id, sku, variation_name: "Default", status: 1 },
      });

      await tx.productPrice.create({
        data: {
          variant_id: variant.id,
          mrp: input.mrp || input.sale_price,
          sale_price: input.sale_price,
          discount,
          tax_percentage: input.tax_rate,
        },
      });

      await tx.productInventory.create({
        data: {
          variant_id: variant.id,
          stock_qty: input.stock_qty,
          reserved_qty: 0,
          low_stock_alert: input.low_stock_alert,
        },
      });

      // The opening count belongs in the ledger too, so the stock history
      // starts where the product does rather than at the first adjustment.
      if (input.stock_qty > 0) {
        await tx.stockTransaction.create({
          data: {
            variant_id: variant.id,
            product_id: created.id,
            type: "IN",
            reference_type: "manual",
            created_by_id: req.auth?.userId ?? null,
            qty: new Prisma.Decimal(input.stock_qty),
            stock_before: new Prisma.Decimal(0),
            stock_after: new Prisma.Decimal(input.stock_qty),
            notes: "Opening stock",
          },
        });
      }

      const media = [
        ...(input.main_image
          ? await attachImages(tx, created.id, MAIN_IMAGE_COLLECTION, [input.main_image])
          : []),
        ...(input.gallery.length
          ? await attachImages(tx, created.id, GALLERY_COLLECTION, input.gallery)
          : []),
      ];

      return { product: created, images: media };
    });

    // adminProductInclude, not productInclude: a draft's variants are filtered
    // out of the public one, so creating one would return no price or stock.
    const full = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: adminProductInclude,
    });

    return res.status(201).json({ product: toProductPayload(full, images) });
  } catch (error) {
    // The files are already in local media storage but nothing now points at them.
    await deleteMediaFiles(uploaded.map((image) => image.file_id));

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = String((error.meta as { target?: unknown })?.target ?? "");
      const field = target.includes("slug") ? "slug" : "product_code";
      throw new HttpError(409, "That product already exists", {
        [field]: ["Already in use"],
      });
    }
    throw error;
  }
}

/** GET /products/:slug — accepts a slug or a numeric id. */
export async function getProduct(req: Request, res: Response) {
  const key = String(req.params["slug"] ?? "");
  const asId = Number(key);

  const product = await prisma.product.findFirst({
    where: {
      deleted_at: null,
      status: 1,
      ...(Number.isInteger(asId) && key !== "" ? { id: asId } : { slug: key }),
    },
    include: productInclude,
  });

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  const images = await imagesByProduct([product.id]);

  return res.status(200).json({
    product: {
      ...toProductPayload(product, images.get(product.id) ?? []),
      description: product.description,
      specific_item_info: product.specific_item_info,
      how_to_use: product.how_to_use,
      meta_title: product.meta_title,
      meta_description: product.meta_description,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        variation_name: variant.variation_name,
        price: variant.price
          ? {
              mrp: money(variant.price.mrp),
              sale_price: money(variant.price.sale_price),
              discount: money(variant.price.discount),
              tax_percentage: money(variant.price.tax_percentage),
              currency: "INR",
            }
          : null,
        available_qty: availableQty(variant),
      })),
    },
  });
}

/** Express 5 types params loosely, hence the narrowing before Number(). */
function numericParam(value: unknown): number {
  return typeof value === "string" && value !== "" ? Number(value) : Number.NaN;
}

async function findProductForAdmin(idParam: unknown) {
  const productId = numericParam(idParam);

  if (!Number.isInteger(productId)) {
    throw new HttpError(400, "Product id must be a number");
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, deleted_at: null },
    select: { id: true },
  });

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  return product;
}

/**
 * POST /products/:id/images — admin only.
 *
 * The bytes went from the browser to local media storage directly; this records the result
 * so the product can find them again. Posting to the "main" collection replaces
 * the existing hero image, gallery posts append.
 */
export async function attachProductImages(req: Request, res: Response) {

  const parsed = attachImagesSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const { images, collection } = parsed.data;
  const isMain = collection === MAIN_IMAGE_COLLECTION;

  if (isMain && images.length > 1) {
    throw new HttpError(422, "Validation failed", {
      images: ["A product has one main image"],
    });
  }

  let product;
  try {
    product = await findProductForAdmin(req.params["id"]);
  } catch (error) {
    // Nothing will ever reference these, so don't leave them in the library.
    await deleteMediaFiles(images.map((image) => image.file_id));
    throw error;
  }

  const existing = await prisma.media.findMany({
    where: {
      model_type: PRODUCT_MODEL_TYPE,
      model_id: product.id,
      collection_name: collection,
    },
    select: { id: true, custom_properties: true },
  });

  if (!isMain && existing.length + images.length > MAX_GALLERY_IMAGES) {
    await deleteMediaFiles(images.map((image) => image.file_id));
    throw new HttpError(422, "Validation failed", {
      images: [`A product can have at most ${MAX_GALLERY_IMAGES} gallery images`],
    });
  }

  const lastPosition = await prisma.media.aggregate({
    where: {
      model_type: PRODUCT_MODEL_TYPE,
      model_id: product.id,
      collection_name: collection,
    },
    _max: { order_column: true },
  });

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (isMain && existing.length) {
        await tx.media.deleteMany({ where: { id: { in: existing.map((row) => row.id) } } });
      }

      return attachImages(
        tx,
        product.id,
        collection,
        images,
        isMain ? 0 : lastPosition._max.order_column ?? 0
      );
    });

    // The replaced hero image is now unreferenced.
    if (isMain && existing.length) {
      await deleteMediaFiles(fileIdsOf(existing));
    }

    return res.status(201).json({ images: created.map(toMediaPayload) });
  } catch (error) {
    await deleteMediaFiles(images.map((image) => image.file_id));
    throw error;
  }
}

/** DELETE /products/:id/images/:mediaId — admin only. */
export async function deleteProductImage(req: Request, res: Response) {
  const product = await findProductForAdmin(req.params["id"]);
  const mediaId = numericParam(req.params["mediaId"]);

  if (!Number.isInteger(mediaId)) {
    throw new HttpError(400, "Image id must be a number");
  }

  const media = await prisma.media.findFirst({
    where: {
      id: mediaId,
      model_type: PRODUCT_MODEL_TYPE,
      model_id: product.id,
    },
    select: { id: true, custom_properties: true },
  });

  if (!media) {
    throw new HttpError(404, "Image not found on this product");
  }

  await prisma.media.delete({ where: { id: media.id } });
  // Row first: an orphaned file is recoverable, a broken image on the site is
  // what customers would see.
  await deleteMediaFiles(fileIdsOf([media]));

  return res.status(200).json({ deleted: media.id });
}
