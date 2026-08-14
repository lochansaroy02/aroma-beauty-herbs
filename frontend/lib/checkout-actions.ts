"use server";

import { revalidatePath } from "next/cache";

import { apiPost, type FieldErrors } from "./api";
import type { Order, PaymentIntent } from "./catalog";
import { getSessionToken } from "./session";

export type CheckoutFields = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  notes?: string;
  save_address?: boolean;
  /** Re-validated by the API at order time, never trusted from the preview. */
  coupon_code?: string;
};

export type ApplyCouponResult =
  | {
      ok: true;
      coupon: { id: number; code: string; name: string | null; description: string | null };
      discount: number;
      totals: { subtotal: number; discount: number; shipping: number; total: number };
    }
  | { ok: false; error: string };

export type PlaceOrderResult =
  | { ok: true; order: Order; payment: PaymentIntent }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export type VerifyResult = { ok: true; order: Order } | { ok: false; error: string };

const SIGNED_OUT = "Your session expired. Log in again.";

/**
 * Checks a coupon against the cart as it stands and reports what it's worth.
 *
 * A preview: nothing is stored and no use is spent. The order endpoint resolves
 * the code again, so a coupon that lapses in between is caught there rather
 * than honoured.
 */
export async function applyCouponAction(code: string): Promise<ApplyCouponResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPost<{
    coupon: { id: number; code: string; name: string | null; description: string | null };
    discount: number;
    totals: { subtotal: number; discount: number; shipping: number; total: number };
  }>("/checkout/coupon", { code }, token);

  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    coupon: result.data.coupon,
    discount: result.data.discount,
    totals: result.data.totals,
  };
}

/**
 * Creates the order and, when Razorpay is configured, the matching Razorpay
 * order. Stock is reserved at this point; the sale isn't final until the
 * payment is verified.
 */
export async function placeOrderAction(
  fields: CheckoutFields
): Promise<PlaceOrderResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPost<{ order: Order; payment: PaymentIntent }>(
    "/checkout",
    fields,
    token
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      ...(result.status === 422 ? { fieldErrors: result.details as FieldErrors } : {}),
    };
  }

  // The cart survives until payment clears, but the header should already
  // reflect the reservation on the next navigation.
  revalidatePath("/", "layout");

  return { ok: true, order: result.data.order, payment: result.data.payment };
}

/**
 * Hands Razorpay's success callback to the API, which checks the signature
 * before anything is marked paid. A forged call here changes nothing.
 */
export async function verifyPaymentAction(
  orderNumber: string,
  payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }
): Promise<VerifyResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPost<{ order: Order }>(
    `/checkout/${encodeURIComponent(orderNumber)}/verify`,
    payload,
    token
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/", "layout");
  return { ok: true, order: result.data.order };
}

/**
 * Test-mode only: marks an order paid with no payment, running the same
 * `markPaid` path the real flow uses. The API refuses it as soon as Razorpay is
 * configured, so this can't survive into production.
 */
export async function simulatePaymentAction(
  orderNumber: string
): Promise<VerifyResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPost<{ order: Order }>(
    `/checkout/${encodeURIComponent(orderNumber)}/simulate`,
    {},
    token
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/", "layout");
  return { ok: true, order: result.data.order };
}

/** Releases the reserved stock when the widget is dismissed or errors. */
export async function cancelPaymentAction(
  orderNumber: string,
  reason?: string
): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;

  await apiPost(
    `/checkout/${encodeURIComponent(orderNumber)}/cancel`,
    { reason: reason ?? "Payment window closed" },
    token
  );

  revalidatePath("/", "layout");
}

/** A fresh Razorpay order for one that failed, without rebuilding the basket. */
export async function retryPaymentAction(
  orderNumber: string
): Promise<{ ok: true; payment: PaymentIntent } | { ok: false; error: string }> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPost<{ payment: PaymentIntent }>(
    `/checkout/${encodeURIComponent(orderNumber)}/retry`,
    {},
    token
  );

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, payment: result.data.payment };
}
