import "server-only";

import { apiGet } from "./api";
import { SECTION_KEYS, type HomeContent } from "./catalog";

const EMPTY: HomeContent = {
  announcement: null,
  hero: null,
  strips: [],
  tiles: [],
  // Defaults, so an unreachable API still renders the blocks in their intended
  // order rather than nothing at all.
  sections: SECTION_KEYS.map((key, index) => ({
    key,
    position: index,
    is_visible: true,
    layout: null,
  })),
};

/**
 * The homepage renders whatever it gets. An unreachable API returns the empty
 * shape rather than throwing, so the site still serves a coherent page with its
 * fallbacks instead of an error screen.
 */
export async function fetchHome(): Promise<HomeContent> {
  const result = await apiGet<HomeContent>("/home");
  return result.ok ? result.data : EMPTY;
}
