import "server-only";

import { apiGet } from "./api";
import type { Order } from "./catalog";

export function fetchOrders(token: string) {
  return apiGet<{ orders: Order[] }>("/orders", token);
}

export function fetchOrder(orderNumber: string, token: string) {
  return apiGet<{ order: Order }>(
    `/orders/${encodeURIComponent(orderNumber)}`,
    token
  );
}
