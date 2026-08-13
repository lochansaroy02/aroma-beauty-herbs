"use server";

import { revalidatePath } from "next/cache";

import { apiDelete, apiPatch, apiPost } from "./api";
import { getSessionToken } from "./session";

export type CartActionResult =
  | { ok: true }
  | { ok: false; error: string; needsLogin?: boolean };

const SIGNED_OUT: CartActionResult = {
  ok: false,
  error: "Log in to use your cart.",
  needsLogin: true,
};

/**
 * Cart and wishlist state shows in the header on every shop page, so a change
 * has to invalidate the whole tree, not just the page that triggered it.
 */
function refresh() {
  revalidatePath("/", "layout");
}

export async function addToCartAction(input: {
  productId: number;
  variantId?: number | null;
  quantity?: number;
}): Promise<CartActionResult> {
  const token = await getSessionToken();
  if (!token) return SIGNED_OUT;

  const result = await apiPost(
    "/cart",
    {
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      quantity: input.quantity ?? 1,
    },
    token
  );

  if (!result.ok) return { ok: false, error: result.error };

  refresh();
  return { ok: true };
}

export async function updateCartItemAction(
  itemId: number,
  quantity: number
): Promise<CartActionResult> {
  const token = await getSessionToken();
  if (!token) return SIGNED_OUT;

  const result = await apiPatch(`/cart/${itemId}`, { quantity }, token);
  if (!result.ok) return { ok: false, error: result.error };

  refresh();
  return { ok: true };
}

export async function removeCartItemAction(itemId: number): Promise<CartActionResult> {
  const token = await getSessionToken();
  if (!token) return SIGNED_OUT;

  const result = await apiDelete(`/cart/${itemId}`, token);
  if (!result.ok) return { ok: false, error: result.error };

  refresh();
  return { ok: true };
}

export async function clearCartAction(): Promise<CartActionResult> {
  const token = await getSessionToken();
  if (!token) return SIGNED_OUT;

  const result = await apiDelete("/cart", token);
  if (!result.ok) return { ok: false, error: result.error };

  refresh();
  return { ok: true };
}

export async function toggleWishlistAction(
  productId: number,
  saved: boolean
): Promise<CartActionResult> {
  const token = await getSessionToken();
  if (!token) {
    return { ok: false, error: "Log in to save products.", needsLogin: true };
  }

  const result = saved
    ? await apiDelete(`/wishlist/${productId}`, token)
    : await apiPost("/wishlist", { product_id: productId }, token);

  if (!result.ok) return { ok: false, error: result.error };

  refresh();
  return { ok: true };
}
