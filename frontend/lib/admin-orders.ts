import "server-only";

import { apiGet } from "./api";
import type { AdminOrderDetail, AdminOrderList, AdminOrderSort } from "./catalog";
import { getSessionToken } from "./session";

export type AdminOrderQuery = {
  page?: number;
  search?: string;
  status?: string;
  payment_status?: string;
  sort?: AdminOrderSort;
};

export function buildAdminOrderQuery(query: AdminOrderQuery): string {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.payment_status) params.set("payment_status", query.payment_status);
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export async function fetchAdminOrders(query: AdminOrderQuery) {
  const token = await getSessionToken();
  return apiGet<AdminOrderList>(
    `/admin/orders${buildAdminOrderQuery(query)}`,
    token ?? undefined
  );
}

export async function fetchAdminOrder(orderNumber: string) {
  const token = await getSessionToken();
  return apiGet<{ order: AdminOrderDetail }>(
    `/admin/orders/${encodeURIComponent(orderNumber)}`,
    token ?? undefined
  );
}
