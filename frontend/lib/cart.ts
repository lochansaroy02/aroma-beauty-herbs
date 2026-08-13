import "server-only";

import { apiGet } from "./api";
import type { Cart, Wishlist } from "./catalog";
import { getSessionToken } from "./session";

const EMPTY_CART: Cart = {
  items: [],
  summary: {
    item_count: 0,
    total_quantity: 0,
    subtotal: 0,
    currency: "INR",
    has_unavailable: false,
  },
};

const EMPTY_WISHLIST: Wishlist = { items: [], product_ids: [], count: 0 };

/**
 * Both fall back to empty rather than erroring: a signed-out visitor browsing
 * the shop should see an empty basket, not a broken header.
 */
export async function fetchCart(): Promise<Cart> {
  const token = await getSessionToken();
  if (!token) return EMPTY_CART;

  const result = await apiGet<Cart>("/cart", token);
  return result.ok ? result.data : EMPTY_CART;
}

export async function fetchWishlist(): Promise<Wishlist> {
  const token = await getSessionToken();
  if (!token) return EMPTY_WISHLIST;

  const result = await apiGet<Wishlist>("/wishlist", token);
  return result.ok ? result.data : EMPTY_WISHLIST;
}
