"use server";

import { revalidatePath } from "next/cache";

import { apiGet, apiPatch, apiPost, type FieldErrors } from "./api";
import type { InventoryItem, StockMovement } from "./catalog";
import { getSessionToken } from "./session";

export type AdjustMode = "set" | "add" | "remove";

export type AdjustResult =
  | { ok: true; item: InventoryItem; warning?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export type AlertResult =
  | { ok: true; item: InventoryItem }
  | { ok: false; error: string };

const SIGNED_OUT = "Your session expired. Log in again.";

function refresh() {
  revalidatePath("/admin/inventory");
  // Availability feeds the catalogue and the admin product list too.
  revalidatePath("/admin/products");
  revalidatePath("/products", "page");
}

export async function adjustStockAction(
  variantId: number,
  input: { mode: AdjustMode; quantity: number; reason?: string }
): Promise<AdjustResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPost<{ item: InventoryItem; warning?: string }>(
    `/admin/inventory/${variantId}/adjust`,
    {
      mode: input.mode,
      quantity: input.quantity,
      ...(input.reason ? { reason: input.reason } : {}),
    },
    token
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      ...(result.status === 422 ? { fieldErrors: result.details as FieldErrors } : {}),
    };
  }

  refresh();

  return {
    ok: true,
    item: result.data.item,
    ...(result.data.warning ? { warning: result.data.warning } : {}),
  };
}

export async function setLowStockAlertAction(
  variantId: number,
  lowStockAlert: number
): Promise<AlertResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPatch<{ item: InventoryItem }>(
    `/admin/inventory/${variantId}/alert`,
    { low_stock_alert: lowStockAlert },
    token
  );

  if (!result.ok) return { ok: false, error: result.error };

  refresh();
  return { ok: true, item: result.data.item };
}

/** Loaded on demand — the ledger is only opened for one variant at a time. */
export async function loadStockHistoryAction(
  variantId: number
): Promise<{ ok: true; history: StockMovement[] } | { ok: false; error: string }> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiGet<{ history: StockMovement[] }>(
    `/admin/inventory/${variantId}/history`,
    token
  );

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, history: result.data.history };
}
