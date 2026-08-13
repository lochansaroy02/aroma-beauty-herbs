/**
 * Shapes and formatters shared by server and client components.
 *
 * Deliberately free of `server-only` and of any fetching: the moment a client
 * component needs `formatPrice` or a product type, importing the fetch module
 * would drag the API layer into the browser bundle. Fetchers live in
 * `lib/products.ts` and `lib/cart.ts`, which are server-only.
 */

export const PRODUCT_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "price_asc", label: "Price low to high" },
  { value: "price_desc", label: "Price high to low" },
  { value: "featured", label: "Featured first" },
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number]["value"];

export type ProductImage = {
  id: number;
  /** Built from MEDIA_BASE_URL plus `path` on every read. */
  url: string;
  path: string;
  file_id: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  name: string;
  mime_type: string | null;
  size: number;
  alt: string | null;
  position: number;
};

export type ProductPrice = {
  mrp: number | null;
  sale_price: number | null;
  discount: number | null;
  tax_percentage: number | null;
  currency: string;
  from: boolean;
};

export type Taxonomy = { id: number; name: string | null; slug: string | null } | null;

export type ProductListItem = {
  id: number;
  product_code: string;
  product_name: string;
  slug: string;
  short_description: string | null;
  product_type: string;
  badge_style: string | null;
  is_featured: boolean;
  is_combo: boolean;
  brand: Taxonomy;
  category: Taxonomy;
  price: ProductPrice | null;
  in_stock: boolean;
  variant_count: number;
  primary_image: ProductImage | null;
  images: ProductImage[];
  created_at: string | null;
};

export type ProductListResponse = {
  products: ProductListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
};

export type ProductVariant = {
  id: number;
  sku: string;
  variation_name: string | null;
  price: Omit<ProductPrice, "from"> | null;
  available_qty: number;
};

export type ProductDetail = ProductListItem & {
  description: string | null;
  specific_item_info: string | null;
  how_to_use: string | null;
  meta_title: string | null;
  meta_description: string | null;
  variants: ProductVariant[];
};

/** The compact product shape carried by cart lines and wishlist entries. */
export type ProductCard = {
  id: number;
  product_name: string;
  slug: string;
  product_code: string;
  short_description: string | null;
  brand: Taxonomy;
  category: Taxonomy;
  price: ProductPrice | null;
  in_stock: boolean;
  image: ProductImage | null;
};

export type CartItem = {
  id: number;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
  /** What it cost when it was added, for spotting a price change. */
  price_at_add: number | null;
  price_changed: boolean;
  available_qty: number;
  unavailable: boolean;
  variant: { id: number; sku: string; variation_name: string | null } | null;
  product: ProductCard;
  added_at: string | null;
};

export type Cart = {
  items: CartItem[];
  summary: {
    item_count: number;
    total_quantity: number;
    subtotal: number;
    currency: string;
    has_unavailable: boolean;
  };
};

export type Wishlist = {
  items: { id: number; product: ProductCard; added_at: string | null }[];
  /** Lets a card decide whether its heart is filled without a lookup. */
  product_ids: number[];
  count: number;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type Order = {
  id: number;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  payment_error: string | null;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax_total: number;
    total: number;
    currency: string;
  };
  items: {
    id: number;
    product_id: number;
    slug: string;
    product_name: string;
    variant_details: string | null;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    tax_amount: number;
    total_price: number;
    image: ProductImage | null;
  }[];
  history: { status: string; remarks: string | null; at: string | null }[];
  notes: string | null;
  placed_at: string | null;
};

/** The homepage's configurable blocks. Every one may be absent. */
export type HomeAnnouncement = { id: number; text: string; url: string | null };

export type HomeHero = {
  id: number;
  title: string | null;
  subtitle: string | null;
  url: string | null;
  cta_label: string | null;
  video: ProductImage;
};

export type HomeStrip = {
  id: number;
  text: string;
  direction: "left" | "right";
  tone: StripTone;
  /** Seconds per loop; null means derive it from the text length. */
  speed: number | null;
  order_by: number;
};

export type HomeTile = {
  id: number;
  title: string | null;
  caption: string | null;
  url: string | null;
  image: ProductImage | null;
};

export type HomeContent = {
  announcement: HomeAnnouncement | null;
  hero: HomeHero | null;
  strips: HomeStrip[];
  featured: ProductCard[];
  tiles: HomeTile[];
  sections: HomeSection[];
};

/* ── Homepage composition ─────────────────────────────────────────────────
   A closed set of blocks whose order, visibility and variant are editable —
   a layout switch, not a page builder. These live here rather than beside the
   fetchers because the admin editors are client components.               */

export const SECTION_KEYS = [
  "announcement",
  "hero",
  "strip_a",
  "featured",
  "strip_b",
  "tiles",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export type HomeSection = {
  key: SectionKey;
  position: number;
  is_visible: boolean;
  layout: string | null;
};

export const STRIP_TONES = ["ink", "leaf"] as const;
export type StripTone = (typeof STRIP_TONES)[number];

export const HERO_LAYOUTS = [
  { value: "full", label: "Full screen", hint: "Video fills the viewport" },
  { value: "contained", label: "Contained", hint: "Inset with rounded corners" },
  { value: "split", label: "Split", hint: "Video beside the wording" },
] as const;

export const TILE_LAYOUTS = [
  { value: "three", label: "Three across", hint: "Equal columns" },
  { value: "two", label: "Two across", hint: "Wider, shorter tiles" },
  { value: "feature", label: "Feature + two", hint: "First tile takes the full width" },
] as const;

export const FEATURED_LAYOUTS = [
  { value: "row", label: "Scrolling row", hint: "One line, swipes sideways" },
  { value: "grid", label: "Grid", hint: "Wraps onto multiple rows" },
] as const;

/** Which variants a block offers, and how it's labelled in the admin. */
export const SECTION_META: Record<
  SectionKey,
  { label: string; hint: string; layouts: readonly { value: string; label: string; hint: string }[] }
> = {
  announcement: { label: "Announcement bar", hint: "The thin line above the header", layouts: [] },
  hero: { label: "Hero video", hint: "The opening video and its wording", layouts: HERO_LAYOUTS },
  strip_a: { label: "Marquee strip (first)", hint: "Scrolling band under the hero", layouts: [] },
  featured: { label: "Featured products", hint: "Products ticked as Featured", layouts: FEATURED_LAYOUTS },
  strip_b: { label: "Marquee strip (second)", hint: "Scrolling band under the products", layouts: [] },
  tiles: { label: "Tile grid", hint: "The closing grid of links", layouts: TILE_LAYOUTS },
};

/** The admin shapes — these carry drafts and inactive rows the storefront never sees. */
export type AdminStrip = {
  id: number;
  text: string;
  direction: "left" | "right";
  tone: StripTone;
  speed: number | null;
  order_by: number;
  is_active: boolean;
};

export type AdminTile = {
  id: number;
  title: string | null;
  caption: string | null;
  url: string | null;
  order_by: number;
  is_active: boolean;
  image: ProductImage | null;
};

export type AdminAnnouncement = {
  id: number;
  text: string;
  url: string | null;
  is_active: boolean;
};

export type AdminHome = {
  announcement: AdminAnnouncement | null;
  strips: AdminStrip[];
  tiles: AdminTile[];
  sections: HomeSection[];
  hero: { configured: boolean; count: number };
};

/** Indian GST slabs. Mirrors GST_SLABS in the API — a closed list on both sides. */
export const GST_SLABS = [0, 5, 12, 18, 28] as const;
export const DEFAULT_GST_SLAB = 18;

export const BADGE_STYLES = [
  { value: "none", label: "No badge" },
  { value: "new", label: "New" },
  { value: "bestseller", label: "Bestseller" },
  { value: "sale", label: "Sale" },
  { value: "limited", label: "Limited edition" },
] as const;

export type BadgeStyle = (typeof BADGE_STYLES)[number]["value"];

/** An image already attached to a product. */
export type SavedProductImage = {
  id: number;
  url: string;
  name: string;
  alt: string | null;
};

/** The admin view of one product — includes drafts and the editable variant. */
export type AdminProduct = {
  id: number;
  product_code: string;
  slug: string;
  product_name: string;
  short_description: string | null;
  description: string | null;
  how_to_use: string | null;
  specific_item_info: string | null;
  meta_title: string | null;
  meta_description: string | null;
  brand: Taxonomy;
  category: Taxonomy;
  product_type: string;
  status: number;
  is_featured: boolean;
  is_combo: boolean;
  badge_style: string | null;
  order_by: number;
  tax_rate: number;
  variant: {
    id: number;
    sku: string;
    variation_name: string | null;
    mrp: number | null;
    sale_price: number | null;
    discount: number | null;
    stock_qty: number;
    reserved_qty: number;
    available_qty: number;
    low_stock_alert: number;
  } | null;
  variant_count: number;
  main_image: ProductImage | null;
  gallery: ProductImage[];
  created_at: string | null;
  updated_at: string | null;
};

export type AdminProductList = {
  products: AdminProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
  summary: { active: number; inactive: number };
};

export type StockState = "out" | "low" | "ok";

/** One stock-tracked variant. Stock lives on variants, not products. */
export type InventoryItem = {
  variant_id: number;
  sku: string;
  variation_name: string | null;
  product: { id: number; product_name: string; slug: string };
  stock_qty: number;
  reserved_qty: number;
  /** stock minus what unpaid orders have already claimed. */
  available_qty: number;
  low_stock_alert: number;
  state: StockState;
  /** Reserved exceeds stock — orders promise more than the shelf holds. */
  oversold: boolean;
  sale_price: number | null;
  updated_at: string | null;
  tracked: boolean;
};

export type InventoryList = {
  items: InventoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
  summary: {
    low_stock: number;
    out_of_stock: number;
    tracked_variants: number;
    total_units: number;
  };
};

export type StockMovement = {
  id: number;
  type: "IN" | "OUT" | "ADJUSTMENT";
  reference_type: string | null;
  reference_id: number | null;
  qty: number;
  stock_before: number;
  stock_after: number;
  notes: string | null;
  by: string | null;
  at: string | null;
};

export const INVENTORY_FILTERS = [
  { value: "all", label: "All" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
  { value: "in_stock", label: "In stock" },
] as const;

export const INVENTORY_SORTS = [
  { value: "stock_asc", label: "Lowest stock first" },
  { value: "stock_desc", label: "Highest stock first" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "updated", label: "Recently updated" },
] as const;

export type InventoryFilter = (typeof INVENTORY_FILTERS)[number]["value"];
export type InventorySort = (typeof INVENTORY_SORTS)[number]["value"];

/** A video section: title, the product it's about, the file, and a status. */
export type VideoSection = {
  id: number;
  title: string | null;
  product: { id: number; product_name: string; slug: string } | null;
  is_active: boolean;
  order_by: number;
  video: {
    id: number;
    url: string;
    path: string;
    file_id: string | null;
    thumbnail_url: string | null;
    width: number | null;
    height: number | null;
    duration: number | null;
    name: string;
    mime_type: string | null;
    size: number;
  } | null;
  created_at: string | null;
  updated_at: string | null;
};

export type VideoList = {
  videos: VideoSection[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
};

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "paid",
  "failed",
  "refunded",
];

/** Mirrors ALLOWED_TRANSITIONS in the API — the API is the one that enforces. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

/** One row of the admin orders table. */
export type AdminOrderRow = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  /** Units ordered, across all lines. */
  item_count: number;
  line_count: number;
  total: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_method: string;
  status: OrderStatus;
  placed_at: string | null;
  account_email: string | null;
};

export type AdminOrderList = {
  orders: AdminOrderRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
  summary: {
    paid_revenue: number;
    awaiting_payment: number;
    currency: string;
  };
};

export type AdminOrderDetail = Order & {
  customer: { id: number; name: string | null; email: string; phone: string | null } | null;
};

export const ADMIN_ORDER_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total_desc", label: "Highest value" },
  { value: "total_asc", label: "Lowest value" },
] as const;

export type AdminOrderSort = (typeof ADMIN_ORDER_SORTS)[number]["value"];

/** What the browser needs to open Razorpay's widget. */
export type PaymentIntent = {
  provider: "razorpay";
  /** False until real keys are in backend/.env — the UI says so plainly. */
  configured: boolean;
  key_id: string | null;
  razorpay_order_id: string | null;
  amount: number;
  currency: string;
};

export type ProductQuery = {
  page?: number;
  limit?: number;
  search?: string;
  featured?: "true" | "false";
  sort?: ProductSort;
};

/**
 * Shortest term the search panel will send. It lives here rather than beside
 * the action because a "use server" module may only export async functions, and
 * both the client panel and the action need to agree on it.
 */
export const MIN_QUERY_LENGTH = 2;

/* ── Dashboard trend ──────────────────────────────────────────────────────
   Here rather than in lib/admin-stats.ts for the same reason: that module is
   server-only, and the chart is a client component. Importing a runtime value
   from it would pull `next/headers` into the browser bundle.               */

export const STAT_GRAINS = [
  { value: "day", label: "Daily", caption: "Last 30 days" },
  { value: "week", label: "Weekly", caption: "Last 12 weeks" },
  { value: "month", label: "Monthly", caption: "Last 12 months" },
] as const;

export type StatGrain = (typeof STAT_GRAINS)[number]["value"];

export function isStatGrain(value: string): value is StatGrain {
  return STAT_GRAINS.some((grain) => grain.value === value);
}

/** One bucket. Empty periods are present with zeros, not omitted. */
export type StatPoint = {
  bucket: string;
  orders: number;
  revenue: number;
};

export type OrderStats = {
  grain: StatGrain;
  points: StatPoint[];
  totals: { orders: number; revenue: number };
};

export function buildProductQuery(query: ProductQuery): string {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.featured) params.set("featured", query.featured);
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

/**
 * The main image isn't part of `images` (that's the gallery collection), so the
 * detail page's gallery is the two put back together.
 */
export function galleryOf(product: ProductDetail): ProductImage[] {
  const seen = new Set<number>();

  return [...(product.primary_image ? [product.primary_image] : []), ...product.images].filter(
    (image) => {
      if (seen.has(image.id)) return false;
      seen.add(image.id);
      return true;
    }
  );
}

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number | null): string {
  return value === null ? "—" : rupees.format(value);
}
