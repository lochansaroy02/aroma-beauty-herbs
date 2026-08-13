import {
  DEFAULT_GST_SLAB,
  type AdminProduct,
  type BadgeStyle,
} from "./catalog";
import type { UploadedImage } from "./media-upload";

/**
 * Everything the product dialog holds, in one object.
 *
 * Numbers live as strings because they come from `<input type="number">`, where
 * a half-typed value and an empty field are both legitimate intermediate
 * states. They're parsed once, at the edge, in `toCreateBody` / `toPatchBody`.
 */
export type ProductFormState = {
  product_name: string;
  brand_id: string;
  category_id: string;
  short_description: string;
  description: string;
  how_to_use: string;

  sku: string;
  mrp: string;
  sale_price: string;
  stock_qty: string;
  low_stock_alert: string;

  status: boolean;
  is_featured: boolean;
  is_combo: boolean;
  tax_rate: string;
  order_by: string;
  badge_style: BadgeStyle;

  /** Newly uploaded, not yet attached to the product. */
  main_image: UploadedImage | null;
  gallery_add: UploadedImage[];
  /** Media ids of saved images the admin removed. Applied on save. */
  removed_media: number[];
  /** True when the saved main image was removed without a replacement. */
  remove_main_image: boolean;
};

export function emptyState(): ProductFormState {
  return {
    product_name: "",
    brand_id: "",
    category_id: "",
    short_description: "",
    description: "",
    how_to_use: "",
    sku: "",
    mrp: "",
    sale_price: "",
    stock_qty: "0",
    low_stock_alert: "0",
    status: true,
    is_featured: false,
    is_combo: false,
    tax_rate: String(DEFAULT_GST_SLAB),
    order_by: "0",
    badge_style: "none",
    main_image: null,
    gallery_add: [],
    removed_media: [],
    remove_main_image: false,
  };
}

export function fromProduct(product: AdminProduct): ProductFormState {
  return {
    product_name: product.product_name,
    brand_id: product.brand ? String(product.brand.id) : "",
    category_id: product.category ? String(product.category.id) : "",
    short_description: product.short_description ?? "",
    description: product.description ?? "",
    how_to_use: product.how_to_use ?? "",
    sku: product.variant?.sku ?? "",
    mrp: product.variant?.mrp != null ? String(product.variant.mrp) : "",
    sale_price:
      product.variant?.sale_price != null ? String(product.variant.sale_price) : "",
    stock_qty: String(product.variant?.stock_qty ?? 0),
    low_stock_alert: String(product.variant?.low_stock_alert ?? 0),
    status: product.status === 1,
    is_featured: product.is_featured,
    is_combo: product.is_combo,
    /**
     * The product's actual rate, never the 18% default. Every legacy row was
     * created with 0, and quietly bumping it while editing a typo would
     * reclassify the tax split on a live price.
     */
    tax_rate: String(product.tax_rate),
    order_by: String(product.order_by ?? 0),
    badge_style: (product.badge_style as BadgeStyle | null) ?? "none",
    main_image: null,
    gallery_add: [],
    removed_media: [],
    remove_main_image: false,
  };
}

/**
 * An "empty" editor serialises to `<p></p>`, so a plain truthiness check would
 * let a blank description through. The API applies the same rule.
 */
export function isBlankHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}

export type FormErrors = Record<string, string[]>;

function positiveNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Client-side gating for the required set.
 *
 * The API enforces these on create but keeps PATCH permissive, because every
 * product that predates this form has a null description and would otherwise
 * be unsaveable. Gating here means the admin is guided to fill it in rather
 * than bounced by a 422 after a round trip.
 */
export function validate(state: ProductFormState): FormErrors {
  const errors: FormErrors = {};

  if (state.product_name.trim().length < 2) {
    errors["product_name"] = ["Give the product a name of at least 2 characters"];
  }
  if (!state.brand_id) errors["brand_id"] = ["Choose a brand"];
  if (!state.category_id) errors["category_id"] = ["Choose a category"];
  if (!state.short_description.trim()) {
    errors["short_description"] = ["Write a short description — it shows on product cards"];
  }
  if (isBlankHtml(state.description)) errors["description"] = ["Write a description"];
  if (!state.sku.trim()) errors["sku"] = ["Give the product a SKU"];

  const mrp = positiveNumber(state.mrp);
  const sale = positiveNumber(state.sale_price);

  if (mrp === null) errors["mrp"] = ["Enter an MRP"];
  if (sale === null) errors["sale_price"] = ["Enter a sale price"];
  if (mrp !== null && sale !== null && mrp > 0 && sale > mrp) {
    errors["sale_price"] = ["Sale price can't be higher than MRP"];
  }

  if (positiveNumber(state.stock_qty) === null) {
    errors["stock_qty"] = ["Enter a stock count"];
  }

  return errors;
}

export function isValid(state: ProductFormState): boolean {
  return Object.keys(validate(state)).length === 0;
}

const num = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** POST /products */
export function toCreateBody(state: ProductFormState) {
  return {
    product_name: state.product_name.trim(),
    brand_id: state.brand_id,
    category_id: state.category_id,
    short_description: state.short_description.trim(),
    description: state.description,
    how_to_use: isBlankHtml(state.how_to_use) ? "" : state.how_to_use,
    sku: state.sku.trim(),
    mrp: num(state.mrp),
    sale_price: num(state.sale_price),
    stock_qty: num(state.stock_qty),
    low_stock_alert: num(state.low_stock_alert),
    status: state.status ? 1 : 0,
    is_featured: state.is_featured,
    is_combo: state.is_combo,
    tax_rate: num(state.tax_rate, 0),
    order_by: num(state.order_by),
    badge_style: state.badge_style,
    main_image: state.main_image,
    gallery: state.gallery_add,
  };
}

/**
 * PATCH /admin/products/:id. Sends the whole form rather than a diff — the API
 * treats every key as optional, and computing a diff client-side would only
 * add a way for the two to disagree.
 */
export function toPatchBody(state: ProductFormState, expectedUpdatedAt: string | null) {
  return {
    product_name: state.product_name.trim(),
    brand_id: state.brand_id,
    category_id: state.category_id,
    short_description: state.short_description.trim(),
    description: state.description,
    how_to_use: isBlankHtml(state.how_to_use) ? "" : state.how_to_use,
    sku: state.sku.trim(),
    mrp: num(state.mrp),
    sale_price: num(state.sale_price),
    stock_qty: num(state.stock_qty),
    low_stock_alert: num(state.low_stock_alert),
    status: state.status ? 1 : 0,
    is_featured: state.is_featured,
    is_combo: state.is_combo,
    tax_rate: num(state.tax_rate, 0),
    order_by: num(state.order_by),
    badge_style: state.badge_style,
    ...(state.main_image ? { main_image: state.main_image } : {}),
    remove_main_image: state.remove_main_image,
    gallery_add: state.gallery_add,
    gallery_remove: state.removed_media,
    ...(expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {}),
  };
}

/** Every uploaded file the form is holding that isn't attached to anything. */
export function pendingUploadIds(state: ProductFormState): string[] {
  return [
    ...(state.main_image ? [state.main_image.file_id] : []),
    ...state.gallery_add.map((image) => image.file_id),
  ];
}
