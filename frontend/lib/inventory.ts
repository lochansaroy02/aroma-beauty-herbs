import "server-only";

import { apiGet } from "./api";
import type { InventoryList, StockMovement } from "./catalog";
import { getSessionToken } from "./session";

export type InventoryQuery = {
  page?: number;
  search?: string;
  filter?: string;
  sort?: string;
};

export function buildInventoryQuery(query: InventoryQuery): string {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.search) params.set("search", query.search);
  if (query.filter && query.filter !== "all") params.set("filter", query.filter);
  if (query.sort && query.sort !== "stock_asc") params.set("sort", query.sort);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export async function fetchInventory(query: InventoryQuery) {
  const token = await getSessionToken();
  return apiGet<InventoryList>(
    `/admin/inventory${buildInventoryQuery(query)}`,
    token ?? undefined
  );
}

export async function fetchStockHistory(variantId: number) {
  const token = await getSessionToken();
  return apiGet<{ history: StockMovement[] }>(
    `/admin/inventory/${variantId}/history`,
    token ?? undefined
  );
}
