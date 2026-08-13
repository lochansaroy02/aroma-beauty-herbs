import "server-only";

import { apiGet } from "./api";
import type { VideoList } from "./catalog";
import { getSessionToken } from "./session";

export type VideoQuery = {
  page?: number;
  search?: string;
  status?: string;
};

export function buildVideoQuery(query: VideoQuery): string {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

/** Admin view: includes inactive sections. */
export async function fetchVideos(query: VideoQuery) {
  const token = await getSessionToken();
  return apiGet<VideoList>(
    `/admin/videos${buildVideoQuery(query)}`,
    token ?? undefined
  );
}
