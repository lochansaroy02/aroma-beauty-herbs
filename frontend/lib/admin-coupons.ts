import "server-only";

import { apiGet } from "./api";
import type { CouponList } from "./catalog";
import { getSessionToken } from "./session";

export type CouponQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
};

export function buildCouponQuery(query: CouponQuery): string {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.limit && query.limit !== 50) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export async function fetchCoupons(query: CouponQuery) {
  const token = await getSessionToken();
  return apiGet<CouponList>(`/admin/coupons${buildCouponQuery(query)}`, token ?? undefined);
}
