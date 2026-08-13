import { prisma } from "./prisma";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

/**
 * Appends -2, -3 … until the slug is free.
 *
 * `excludeId` is what makes this safe on an update: without it a product
 * re-saved with its own unchanged slug matches itself, and gets renamed to
 * "-2" for no reason.
 */
export async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  const root = base || "product";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const taken = await prisma.product.findFirst({
      where: {
        slug: candidate,
        ...(excludeId === undefined ? {} : { NOT: { id: excludeId } }),
      },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${root}-${Date.now()}`;
}

export async function uniqueProductCode(
  base: string,
  excludeId?: number
): Promise<string> {
  const root = (base || "PRD").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PRD";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const taken = await prisma.product.findFirst({
      where: {
        product_code: candidate,
        ...(excludeId === undefined ? {} : { NOT: { id: excludeId } }),
      },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${root}-${Date.now()}`;
}

/** Taxonomy slugs have no unique constraint, so this is best-effort tidiness. */
export async function uniqueTaxonomySlug(
  model: "brand" | "category",
  base: string
): Promise<string> {
  const root = base || model;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const taken =
      model === "brand"
        ? await prisma.brand.findFirst({ where: { slug: candidate }, select: { id: true } })
        : await prisma.category.findFirst({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }

  return `${root}-${Date.now()}`;
}
