"use server";

import { revalidatePath } from "next/cache";

import { apiPatch } from "./api";
import type { OrderStatus } from "./catalog";
import { getSessionToken } from "./session";

export type StatusResult = { ok: true } | { ok: false; error: string };

/**
 * Moves an order along the fulfilment path. The API enforces which transitions
 * are legal, so a stale page can't push an order somewhere it shouldn't go.
 */
export async function updateOrderStatusAction(
  orderNumber: string,
  status: OrderStatus,
  remarks?: string
): Promise<StatusResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: "Your session expired. Log in again." };

  const result = await apiPatch(
    `/admin/orders/${encodeURIComponent(orderNumber)}/status`,
    { status, ...(remarks ? { remarks } : {}) },
    token
  );

  if (!result.ok) return { ok: false, error: result.error };

  // The row appears on the list and the detail page; refresh both.
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderNumber}`);

  return { ok: true };
}
