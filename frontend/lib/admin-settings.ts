import "server-only";

import { apiGet } from "./api";
import { getSessionToken } from "./session";
import type { MediaSettings } from "./catalog";

/**
 * Fetching only. The shapes live in `catalog.ts` because the toggle is a client
 * component, and importing a runtime value from here would pull `next/headers`
 * into the browser bundle.
 */
export async function fetchMediaSettings() {
  const token = await getSessionToken();
  return apiGet<MediaSettings>("/admin/settings/media", token ?? undefined);
}
