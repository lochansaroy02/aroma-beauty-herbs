import "server-only";

/**
 * The product catalogue, read from barbersyndicate.in.
 *
 * This site is a landing page, not a shop: it owns no products, no cart and no
 * checkout. The four kits below live in Barber Syndicate's catalogue and are
 * read from their public API on every render (cached — see REVALIDATE_SECONDS).
 * "Shop now" then hands the visitor over to that site to actually buy.
 *
 * Nothing here writes. If the API is unreachable the page degrades to whatever
 * it could load rather than erroring, which is the same bargain `lib/home.ts`
 * makes for the homepage blocks.
 */

/** Origin of the catalogue API. Override if it ever moves. */
const API_BASE = (
  process.env.SHOP_API_BASE ?? "https://barbersyndicate.in/api"
).replace(/\/+$/, "");

/** Origin of the storefront a "Shop now" click lands on. */
const STOREFRONT_BASE = (
  process.env.SHOP_STOREFRONT_BASE ?? "https://barbersyndicate.in"
).replace(/\/+$/, "");

const BRAND = "aroma-beauty-herbs";

/**
 * How long a product stays cached before it is re-fetched.
 *
 * Price and stock come from someone else's database, so this is the window in
 * which this site can be wrong about them. Five minutes is short enough that a
 * price change shows up the same session and long enough that the landing page
 * isn't hammering their API once per visitor.
 *
 * Note the expiry is stale-while-revalidate: the first request after it lapses
 * is served the OLD copy and only triggers the refetch in the background, so on
 * a quiet site the first visitor after a change still sees stale copy. That is
 * why CATALOGUE_TAG exists — see `refreshCatalogueAction`.
 */
const REVALIDATE_SECONDS = 300;

/**
 * Cache tag for every catalogue fetch, so all four can be dropped at once.
 *
 * Editing a product on barbersyndicate.in cannot notify this site, and waiting
 * out the window means the first person to look gets yesterday's copy — with
 * links to yesterday's slugs, which 404 once a product is renamed. Revalidating
 * this tag makes an edit visible on the next request instead.
 */
export const CATALOGUE_TAG = "shop-catalogue";

/**
 * The range, in the order it should appear.
 *
 * These are the API's short keywords, which it resolves within the brand by
 * exact slug → slug prefix → keyword. Full slugs work too and are less
 * ambiguous, but the keyword is what survives a product being renamed, which is
 * the likelier event with four hand-curated entries.
 */
export const PRODUCT_KEYS = ["bridal", "korean", "japanese", "d-tan"] as const;

export type ProductKey = (typeof PRODUCT_KEYS)[number];

export type ShopImage = {
  url: string;
  /** A generated webp; falls back to `url` when the API has no conversion. */
  thumb: string;
  type: string;
};

export type ShopProduct = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  product_code: string | null;
  short_description: string | null;
  /** Raw HTML from the API — sanitise before rendering. See `lib/rich-text.ts`. */
  description: string | null;
  how_to_use: string | null;
  specific_item_info: string | null;
  sale_price: number | null;
  mrp: number | null;
  /**
   * Whether the MRP is worth showing struck through.
   *
   * Derived rather than read from the API's `discount`, because that field
   * can disagree with the prices beside it — one kit currently reports a
   * discount while its sale_price sits *above* its MRP. A strikethrough is only
   * honest when the MRP is genuinely the higher number.
   */
  discounted: boolean;
  in_stock: boolean;
  brand_name: string | null;
  category_name: string | null;
  rating: { average: number; count: number } | null;
  images: ShopImage[];
  /** Where "Shop now" goes. */
  shop_url: string;
};

/** The subset of the API payload this site reads. */
type ApiProduct = {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  sku?: unknown;
  product_code?: unknown;
  short_description?: unknown;
  description?: unknown;
  how_to_use?: unknown;
  specific_item_info?: unknown;
  sale_price?: unknown;
  mrp?: unknown;
  in_stock?: unknown;
  brand?: { name?: unknown } | null;
  category?: { name?: unknown } | null;
  rating?: { average?: unknown; count?: unknown } | null;
  main_image?: unknown;
  images?: unknown;
  all_images?: unknown;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

/**
 * Builds the image list, preferring `all_images` because it carries the webp
 * thumbnails. `images` is the flat fallback, and `main_image` the last resort —
 * a product with one photo and no conversions still has to render.
 */
function imagesOf(product: ApiProduct): ShopImage[] {
  const structured = Array.isArray(product.all_images) ? product.all_images : [];

  const fromStructured = structured.flatMap((entry): ShopImage[] => {
    const row = entry as { url?: unknown; thumb?: unknown; type?: unknown };
    const url = str(row.url);
    if (!url) return [];
    return [{ url, thumb: str(row.thumb) ?? url, type: str(row.type) ?? "gallery" }];
  });

  if (fromStructured.length) return fromStructured;

  const flat = Array.isArray(product.images) ? product.images : [];
  const fromFlat = flat.flatMap((entry): ShopImage[] => {
    const url = str(entry);
    return url ? [{ url, thumb: url, type: "gallery" }] : [];
  });

  if (fromFlat.length) return fromFlat;

  const main = str(product.main_image);
  return main ? [{ url: main, thumb: main, type: "main" }] : [];
}

function normalise(product: ApiProduct): ShopProduct | null {
  const id = num(product.id);
  const name = str(product.name);
  const slug = str(product.slug);

  // Without these three there is nothing to render and nowhere to send a click.
  if (id === null || !name || !slug) return null;

  const sale_price = num(product.sale_price);
  const mrp = num(product.mrp);

  const rating = product.rating
    ? {
        average: num(product.rating.average) ?? 0,
        count: num(product.rating.count) ?? 0,
      }
    : null;

  return {
    id,
    name,
    slug,
    sku: str(product.sku),
    product_code: str(product.product_code),
    short_description: str(product.short_description),
    description: str(product.description),
    how_to_use: str(product.how_to_use),
    specific_item_info: str(product.specific_item_info),
    sale_price,
    mrp,
    discounted: mrp !== null && sale_price !== null && mrp > sale_price,
    // Absent means available: a missing flag shouldn't read as "sold out".
    in_stock: product.in_stock !== false,
    brand_name: str(product.brand?.name),
    category_name: str(product.category?.name),
    rating,
    images: imagesOf(product),
    /**
     * Every product's storefront path is its own slug, so the link is derived
     * rather than kept in a map that would silently rot when a product is
     * renamed on the other side.
     */
    shop_url: `${STOREFRONT_BASE}/product/${slug}`,
  };
}

/**
 * One product by key or full slug.
 *
 * Returns null rather than throwing: a single unreachable product should cost
 * that one card, not the whole page.
 */
export async function fetchShopProduct(key: string): Promise<ShopProduct | null> {
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE}/products/brand/${BRAND}/${encodeURIComponent(key)}`,
      { next: { revalidate: REVALIDATE_SECONDS, tags: [CATALOGUE_TAG] } }
    );
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const payload: unknown = await response.json().catch(() => null);
  const data = (payload as { data?: ApiProduct } | null)?.data;

  return data ? normalise(data) : null;
}

/**
 * The whole range, in PRODUCT_KEYS order.
 *
 * Fetched in parallel and filtered: whatever resolved is what renders. Callers
 * can compare the length against PRODUCT_KEYS if they need to know something
 * was missed.
 */
export async function fetchShopProducts(): Promise<ShopProduct[]> {
  const results = await Promise.all(PRODUCT_KEYS.map((key) => fetchShopProduct(key)));
  return results.filter((product): product is ShopProduct => product !== null);
}
