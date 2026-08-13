"use server";

import { revalidatePath } from "next/cache";

import { apiGet, apiPatch, apiPost, type FieldErrors } from "./api";
import type { AdminProduct } from "./catalog";
import { getSessionToken } from "./session";
import { toCreateBody, toPatchBody, type ProductFormState } from "./product-form";

export type SaveProductResult =
  | { ok: true; product: AdminProduct }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export type LoadProductResult =
  | { ok: true; product: AdminProduct }
  | { ok: false; error: string };

const SIGNED_OUT = "Your session expired. Log in again.";

/** Stock and status feed the catalogue and the inventory screen too. */
function refresh() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/products", "page");
}

function toResult(result: {
  ok: false;
  status: number;
  error: string;
  details?: unknown;
}): SaveProductResult {
  return {
    ok: false,
    error: result.error,
    ...(result.status === 422 || result.status === 409
      ? { fieldErrors: result.details as FieldErrors }
      : {}),
  };
}

export async function createProductAction(
  state: ProductFormState
): Promise<SaveProductResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPost<{ product: AdminProduct }>(
    "/products",
    toCreateBody(state),
    token
  );

  if (!result.ok) return toResult(result);

  refresh();
  return { ok: true, product: result.data.product };
}

export async function updateProductAction(
  id: number,
  state: ProductFormState,
  expectedUpdatedAt: string | null
): Promise<SaveProductResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPatch<{ product: AdminProduct }>(
    `/admin/products/${id}`,
    toPatchBody(state, expectedUpdatedAt),
    token
  );

  if (!result.ok) return toResult(result);

  refresh();
  return { ok: true, product: result.data.product };
}

/**
 * Loaded on demand when Edit is clicked rather than fattening every list row
 * with two HTML blobs — and it narrows the window in which someone else's
 * change goes unnoticed.
 */
export async function loadProductForEditAction(id: number): Promise<LoadProductResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiGet<{ product: AdminProduct }>(`/admin/products/${id}`, token);

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, product: result.data.product };
}
