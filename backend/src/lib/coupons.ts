import { HttpError } from "./http-error";
import { prisma } from "./prisma";
import { round2 } from "./pricing";

/**
 * Coupon rules, in one place.
 *
 * The checkout preview and the order that actually gets written both go through
 * `resolveCoupon`, so the discount a shopper is shown is the discount they get.
 * Two implementations of "is this code still valid" is exactly how a shopper
 * ends up seeing ₹200 off and being charged full price.
 */

/** `status` is an Int on this table: 1 active, 0 not. */
export const COUPON_ACTIVE = 1;
export const COUPON_INACTIVE = 0;

export type CouponSummary = {
  id: number;
  code: string;
  name: string | null;
  type: "fixed" | "percent";
  value: number;
  description: string | null;
};

export type ResolvedCoupon = {
  coupon: CouponSummary;
  /** Rupees off the subtotal, already rounded and capped. */
  discount: number;
};

/**
 * The discount a coupon is worth against a given subtotal.
 *
 * Percentage coupons are capped by `max_spend` when one is set — read as "the
 * most this coupon may take off", which is how a "20% off, up to ₹500" offer is
 * expressed. A discount is never allowed to exceed the subtotal, so an order
 * can't total less than its shipping.
 */
export function discountFor(
  coupon: { type: string; value: unknown; max_spend: unknown },
  subtotal: number
): number {
  const value = Number(coupon.value ?? 0);
  if (!(value > 0) || subtotal <= 0) return 0;

  const raw = coupon.type === "percent" ? (subtotal * value) / 100 : value;

  const ceiling = coupon.max_spend === null || coupon.max_spend === undefined
    ? Number.POSITIVE_INFINITY
    : Number(coupon.max_spend);

  return round2(Math.min(raw, ceiling, subtotal));
}

/**
 * Looks a code up and checks every rule against this shopper and this basket.
 *
 * Throws a 422 with a message meant to be shown as-is: a shopper who typed a
 * code needs to know whether it's expired, not yet started, already used up or
 * simply doesn't apply to what's in their basket.
 */
export async function resolveCoupon(
  code: string,
  userId: number,
  subtotal: number
): Promise<ResolvedCoupon> {
  const trimmed = code.trim();
  if (!trimmed) throw new HttpError(422, "Enter a coupon code");

  const coupon = await prisma.coupon.findFirst({
    // Codes are printed on flyers and typed by hand, so matching is
    // case-insensitive rather than making "summer10" a different offer.
    where: { code: { equals: trimmed, mode: "insensitive" }, deleted_at: null },
  });

  // Deliberately the same message for "no such code" and "switched off": an
  // inactive coupon isn't something a shopper can act on either way.
  if (!coupon || coupon.status !== COUPON_ACTIVE) {
    throw new HttpError(422, "That coupon code isn't valid");
  }

  const now = new Date();

  if (coupon.start_date && coupon.start_date > now) {
    throw new HttpError(422, "That coupon isn't active yet");
  }

  if (coupon.end_date && coupon.end_date < now) {
    throw new HttpError(422, "That coupon has expired");
  }

  if (
    coupon.usage_limit_per_coupon !== null &&
    coupon.usage_count >= coupon.usage_limit_per_coupon
  ) {
    throw new HttpError(422, "That coupon has been fully redeemed");
  }

  if (coupon.usage_limit_per_user !== null) {
    // Counted from orders rather than a separate ledger: an order carries the
    // coupon it was placed with, and a cancelled one still counts as a use.
    const used = await prisma.order.count({
      where: { user_id: userId, coupon_id: coupon.id },
    });

    if (used >= coupon.usage_limit_per_user) {
      throw new HttpError(422, "You've already used that coupon");
    }
  }

  if (coupon.min_spend !== null && subtotal < Number(coupon.min_spend)) {
    throw new HttpError(
      422,
      `That coupon needs a basket of at least ₹${Number(coupon.min_spend)}`
    );
  }

  const discount = discountFor(coupon, subtotal);

  if (discount <= 0) {
    throw new HttpError(422, "That coupon doesn't take anything off this basket");
  }

  return {
    coupon: {
      id: coupon.id,
      code: coupon.code ?? trimmed,
      name: coupon.name,
      type: coupon.type,
      value: Number(coupon.value),
      description: coupon.description,
    },
    discount,
  };
}
