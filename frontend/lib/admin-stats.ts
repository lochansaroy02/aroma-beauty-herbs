import "server-only";

import { apiGet } from "./api";
import { getSessionToken } from "./session";
import type { OrderStats, StatGrain } from "./catalog";

/**
 * Fetching only. The grain list, its types, and the guard live in `catalog.ts`
 * because the chart is a client component — importing a runtime value from this
 * module would drag `next/headers` into the browser bundle.
 */
export async function fetchOrderStats(grain: StatGrain) {
  const token = await getSessionToken();
  return apiGet<OrderStats>(`/admin/stats/orders?grain=${grain}`, token ?? undefined);
}
