import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { slugify, uniqueTaxonomySlug } from "../lib/slug";
import { createBrandSchema, createCategorySchema } from "../schemas/taxonomy.schema";

/** GET /categories — active categories, for pickers and filters. */
export async function listCategories(_req: Request, res: Response) {
  const categories = await prisma.category.findMany({
    where: { deleted_at: null, status: 1 },
    select: { id: true, name: true, slug: true, parent_id: true },
    orderBy: [{ order_by: "asc" }, { name: "asc" }],
  });

  return res.status(200).json({ categories });
}

/** GET /brands — active brands, for pickers and filters. */
export async function listBrands(_req: Request, res: Response) {
  const brands = await prisma.brand.findMany({
    where: { deleted_at: null, status: 1 },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return res.status(200).json({ brands });
}

/**
 * POST /admin/brands — admin only.
 *
 * Brand is a required field on a product, so without this a database with no
 * brand rows can't create any product at all. Mounted on the admin router, not
 * alongside the public listing routes, which carry no auth.
 *
 * A duplicate name returns 409 *with the existing row*, so the caller can
 * select it instead of being told off for a reasonable mistake. `brands.slug`
 * has no unique constraint, so this check is the only guard — best-effort under
 * concurrency, which is acceptable for a hand-typed admin field.
 */
export async function createBrand(req: Request, res: Response) {
  const parsed = createBrandSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const { name } = parsed.data;

  const existing = await prisma.brand.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, deleted_at: null },
    select: { id: true, name: true, slug: true },
  });

  if (existing) {
    throw new HttpError(409, `"${existing.name}" already exists`, {
      name: ["Already exists"],
      existing,
    });
  }

  const brand = await prisma.brand.create({
    data: {
      name,
      slug: await uniqueTaxonomySlug("brand", slugify(name)),
      status: 1,
      created_by_id: req.auth?.userId ?? null,
    },
    select: { id: true, name: true, slug: true },
  });

  return res.status(201).json({ brand });
}

/** POST /admin/categories — admin only. See createBrand for the 409 semantics. */
export async function createCategory(req: Request, res: Response) {
  const parsed = createCategorySchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const { name, parent_id } = parsed.data;

  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, deleted_at: null },
    select: { id: true, name: true, slug: true, parent_id: true },
  });

  if (existing) {
    throw new HttpError(409, `"${existing.name}" already exists`, {
      name: ["Already exists"],
      existing,
    });
  }

  // `level` is depth in the tree; a root category is 1.
  let level = 1;

  if (parent_id !== undefined) {
    const parent = await prisma.category.findFirst({
      where: { id: parent_id, deleted_at: null },
      select: { id: true, level: true },
    });

    if (!parent) {
      throw new HttpError(422, "Validation failed", { parent_id: ["Category not found"] });
    }

    level = (parent.level ?? 1) + 1;
  }

  const category = await prisma.category.create({
    data: {
      name,
      slug: await uniqueTaxonomySlug("category", slugify(name)),
      ...(parent_id === undefined ? {} : { parent_id }),
      level,
      status: 1,
      show_in_menu: true,
      is_featured: false,
      created_by_id: req.auth?.userId ?? null,
    },
    select: { id: true, name: true, slug: true, parent_id: true },
  });

  return res.status(201).json({ category });
}
