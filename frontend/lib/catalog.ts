/**
 * Shapes and formatters shared by server and client components.
 *
 * Deliberately free of `server-only` and of any fetching: the moment a client
 * component needs `formatPrice` or a home-block type, importing a fetch module
 * would drag the API layer into the browser bundle. Fetchers live in
 * `lib/home.ts`, `lib/videos.ts` and friends, which are server-only.
 *
 * Everything here describes THIS site's own data — the homepage an admin
 * composes, its media, and contact enquiries. The product catalogue is not in
 * this file: it belongs to barbersyndicate.in and its shapes live in
 * `lib/shop-api.ts`, next to the fetcher that knows how to read them.
 */

/** A file from our own media library — a hero video, or a tile's image. */
export type MediaImage = {
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

export type HomeAnnouncement = { id: number; text: string; url: string | null };

export type HomeHero = {
  id: number;
  title: string | null;
  subtitle: string | null;
  url: string | null;
  cta_label: string | null;
  video: MediaImage;
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
  image: MediaImage | null;
};

export type HomeContent = {
  announcement: HomeAnnouncement | null;
  hero: HomeHero | null;
  strips: HomeStrip[];
  /**
   * No `featured` here: that block's products come from barbersyndicate.in and
   * are fetched by the page, not by /home. The block itself still appears in
   * `sections` — its order, visibility and layout remain ours to set.
   */
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
  featured: { label: "Featured products", hint: "The range, read from the Barber Syndicate catalogue", layouts: FEATURED_LAYOUTS },
  strip_b: { label: "Marquee strip (second)", hint: "Scrolling band under the products", layouts: [] },
  tiles: { label: "Tile grid", hint: "The closing grid of links", layouts: TILE_LAYOUTS },
};

/* ── Media storage ────────────────────────────────────────────────────────
   Which storage NEW uploads go to. Existing files keep the disk they were
   written to, so switching never moves or breaks anything already uploaded. */

export const MEDIA_DRIVERS = [
  {
    value: "local",
    label: "Local disk",
    hint: "Files live on the API server and are served from it. No third party, no limits, but they are yours to back up.",
  },
  {
    value: "imagekit",
    label: "ImageKit",
    hint: "Files go to ImageKit's CDN. Takes image traffic off the server; needs the keys in backend/.env.",
  },
] as const;

export type MediaDriver = (typeof MEDIA_DRIVERS)[number]["value"];

export type MediaSettings = {
  driver: MediaDriver;
  /** "env" until an admin overrides it here, then "database". */
  source: "env" | "database";
  /** How many stored files sit on each disk. */
  counts: Record<string, number>;
  local: { root: string; base_url: string };
  imagekit: { configured: boolean; endpoint: string | null };
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
  image: MediaImage | null;
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


export type VideoSection = {
  id: number;
  title: string | null;
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

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Prices arrive as plain numbers from the catalogue API; this is the only place they get formatted. */
export function formatPrice(value: number | null): string {
  return value === null ? "—" : rupees.format(value);
}

/* ── Contact enquiries (admin) ──────────────────────────────────────────── */

export type ContactStatus = "pending" | "working" | "completed";

/** Ordered as the work actually flows, which is how the dropdown reads. */
export const CONTACT_STATUSES: readonly {
  value: ContactStatus;
  label: string;
}[] = [
  { value: "pending", label: "Pending" },
  { value: "working", label: "Working" },
  { value: "completed", label: "Completed" },
];

export type ContactMessage = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: ContactStatus;
  /** Whether the notification email to staff actually went out. */
  notified: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ContactMessageList = {
  messages: ContactMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
  counts: { pending: number; working: number; completed: number; all: number };
  applied: {
    search: string | null;
    status: ContactStatus | null;
    sort: string;
    limit: number;
  };
};

/** "Show entries" options, matching the other admin lists. */
export const CONTACT_PAGE_SIZES = [25, 50, 100] as const;

export const CONTACT_SORTS: readonly { value: string; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];
