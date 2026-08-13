import "server-only";

import { apiGet } from "./api";
import { getSessionToken } from "./session";
import type { AdminHome } from "./catalog";

/**
 * Fetching only. The shapes and the layout catalogues live in `catalog.ts`
 * because the customisation editors are client components, and importing a
 * runtime value from here would drag `next/headers` into the browser bundle.
 */
export async function fetchAdminHome() {
  const token = await getSessionToken();
  return apiGet<AdminHome>("/admin/home", token ?? undefined);
}
