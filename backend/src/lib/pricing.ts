/**
 * Order arithmetic, in one place so the cart, the checkout summary and the
 * stored order can never disagree.
 *
 * Indian retail quotes GST-inclusive prices, so `sale_price` is treated as the
 * amount the customer pays and the tax is backed out of it. That's what fills
 * OrderItem's rate_include_gst / rate_exclude_gst columns.
 */

/** Placeholder logistics rule — change these two when real rates are agreed. */
export const SHIPPING_FLAT_RATE = 49;
export const FREE_SHIPPING_OVER = 499;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function shippingFor(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT_RATE;
}

export type LineInput = {
  unitPrice: number;
  quantity: number;
  taxPercentage: number;
};

export type LineTotals = {
  /** Per unit, tax included — what the shopper sees on the product page. */
  rateIncludeGst: number;
  rateExcludeGst: number;
  gstRate: number;
  includeGstTotal: number;
  excludeGstTotal: number;
  taxAmount: number;
  unitPrice: number;
  totalPrice: number;
};

export function lineTotals(line: LineInput): LineTotals {
  const rate = Math.max(0, line.taxPercentage);
  const includeGstTotal = round2(line.unitPrice * line.quantity);

  // Extract the tax already baked into the price: total × rate / (100 + rate).
  const taxAmount = rate > 0 ? round2((includeGstTotal * rate) / (100 + rate)) : 0;
  const excludeGstTotal = round2(includeGstTotal - taxAmount);

  return {
    rateIncludeGst: round2(line.unitPrice),
    rateExcludeGst: rate > 0 ? round2(line.unitPrice / (1 + rate / 100)) : round2(line.unitPrice),
    gstRate: rate,
    includeGstTotal,
    excludeGstTotal,
    taxAmount,
    unitPrice: round2(line.unitPrice),
    totalPrice: includeGstTotal,
  };
}

export type OrderTotals = {
  subtotal: number;
  taxTotal: number;
  shipping: number;
  discount: number;
  total: number;
};

/** `subtotal` is tax-inclusive, so the total is subtotal + shipping − discount. */
export function orderTotals(lines: LineTotals[], discount = 0): OrderTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.includeGstTotal, 0));
  const taxTotal = round2(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const shipping = shippingFor(subtotal);
  const capped = Math.min(discount, subtotal);

  return {
    subtotal,
    taxTotal,
    shipping,
    discount: round2(capped),
    total: round2(subtotal + shipping - capped),
  };
}
