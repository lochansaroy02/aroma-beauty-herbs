import { z } from "zod";

const required = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} is required`).max(max);

export const billingSchema = z.object({
  first_name: required("First name", 60),
  last_name: required("Last name", 60),
  email: z.email("Enter a valid email address").max(180),
  // Indian mobile numbers, with or without the +91 / 0 prefix.
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+?91[- ]?|0)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  address_line_1: required("Address", 255),
  address_line_2: z.string().trim().max(255).optional(),
  city: required("City", 90),
  state: required("State", 90),
  zip: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  country: z.string().trim().max(90).optional().default("India"),
});

/** Blank means "no coupon" rather than an empty code to look up. */
export const couponCodeSchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code").max(50),
});

export const checkoutSchema = billingSchema.extend({
  notes: z.string().trim().max(500).optional(),
  /** Keeps the address on the account for next time. */
  save_address: z.coerce.boolean().optional().default(false),
  /**
   * Re-validated server-side at order time, never trusted from the preview:
   * a coupon can expire or run out between applying it and paying.
   */
  coupon_code: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((value) => value || undefined),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(120),
  razorpay_payment_id: z.string().trim().min(1).max(120),
  razorpay_signature: z.string().trim().min(1).max(256),
});

export const cancelPaymentSchema = z.object({
  /** Whatever Razorpay's widget reported, kept for support to look at. */
  reason: z.string().trim().max(500).optional(),
});
