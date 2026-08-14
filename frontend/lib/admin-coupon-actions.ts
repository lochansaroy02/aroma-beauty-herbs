"use server";

import { revalidatePath } from "next/cache";

import { apiDelete, apiPatch, apiPost, type FieldErrors } from "./api";
import type { Coupon, CouponDraft } from "./catalog";
import { getSessionToken } from "./session";

export type CouponResult =
  | { ok: true; notice?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/**
 * The form holds strings; the API wants numbers, dates or absence.
 *
 * A blank optional field is sent as `null` rather than omitted, because on an
 * update those two mean different things: omitted leaves the column alone,
 * while null is how "No minimum" clears a limit that was set before.
 */
async function toBody(draft: CouponDraft): Promise<Record<string, unknown>> {
  const optional = (value: string) => (value.trim() === "" ? null : value.trim());

  return {
    name: draft.name.trim(),
    code: draft.code.trim(),
    type: draft.type,
    value: draft.value.trim(),
    min_spend: optional(draft.min_spend),
    max_spend: optional(draft.max_spend),
    usage_limit_per_coupon: optional(draft.usage_limit_per_coupon),
    usage_limit_per_user: optional(draft.usage_limit_per_user),
    start_date: optional(draft.start_date),
    end_date: optional(draft.end_date),
    description: draft.description.trim(),
    status: draft.is_active,
  };
}

async function fail(result: {
  status: number;
  error: string;
  details?: unknown;
}): Promise<CouponResult> {
  return {
    ok: false,
    error: result.error,
    ...(result.status === 422 && result.details
      ? { fieldErrors: result.details as FieldErrors }
      : {}),
  };
}

export async function createCouponAction(draft: CouponDraft): Promise<CouponResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: "Your session has expired. Sign in again." };

  const result = await apiPost<{ coupon: Coupon }>(
    "/admin/coupons",
    await toBody(draft),
    token
  );

  if (!result.ok) return fail(result);

  revalidatePath("/admin/coupons");
  return { ok: true, notice: "Coupon created." };
}

export async function updateCouponAction(
  id: number,
  draft: CouponDraft
): Promise<CouponResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: "Your session has expired. Sign in again." };

  const result = await apiPatch<{ coupon: Coupon }>(
    `/admin/coupons/${id}`,
    await toBody(draft),
    token
  );

  if (!result.ok) return fail(result);

  revalidatePath("/admin/coupons");
  return { ok: true, notice: "Coupon updated." };
}

export async function toggleCouponAction(
  id: number,
  status: boolean
): Promise<CouponResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: "Your session has expired. Sign in again." };

  const result = await apiPatch<{ coupon: Coupon }>(
    `/admin/coupons/${id}/status`,
    { status },
    token
  );

  if (!result.ok) return fail(result);

  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function deleteCouponAction(id: number): Promise<CouponResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: "Your session has expired. Sign in again." };

  const result = await apiDelete<null>(`/admin/coupons/${id}`, token);
  if (!result.ok) return fail(result);

  revalidatePath("/admin/coupons");
  return { ok: true, notice: "Coupon deleted." };
}
