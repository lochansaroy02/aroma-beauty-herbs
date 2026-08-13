import "server-only";

import { apiGet } from "./api";
import type { AdminProductList } from "./catalog";
import { buildProductQuery, type ProductQuery } from "./catalog";
import { getSessionToken } from "./session";

export type AdminProductQuery = ProductQuery & { status?: string };

/** Unlike `fetchProducts`, this includes drafts — admins must be able to edit them. */
export async function fetchAdminProducts(query: AdminProductQuery) {
  const token = await getSessionToken();
  const base = buildProductQuery(query);
  const suffix =
    query.status && query.status !== "all"
      ? `${base ? "&" : "?"}status=${encodeURIComponent(query.status)}`
      : "";

  return apiGet<AdminProductList>(`/admin/products${base}${suffix}`, token ?? undefined);
}
