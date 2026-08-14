import "server-only";

import { apiGet } from "./api";
import type { ContactMessageList } from "./catalog";
import { getSessionToken } from "./session";

export type ContactQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
};

/** The query string for a set of filters, with defaults left out of the URL. */
export function buildContactQuery(query: ContactQuery): string {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.limit && query.limit !== 50) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export async function fetchContactMessages(query: ContactQuery) {
  const token = await getSessionToken();
  return apiGet<ContactMessageList>(
    `/admin/contact${buildContactQuery(query)}`,
    token ?? undefined
  );
}
