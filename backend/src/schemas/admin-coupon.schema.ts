import { z } from "zod";

/** Validation for the admin's coupon screen. */

export const COUPON_TYPES = ["fixed", "percent"] as const;

export type CouponTypeValue = (typeof COUPON_TYPES)[number];

const optionalText = z.string().trim().min(1).max(120).optional().catch(undefined);

export const listCouponsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).default(50).catch(50),
  /** Matches the internal title or the code. */
  search: optionalText,
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
});

export type ListCouponsQuery = z.infer<typeof listCouponsSchema>;

/**
 * Codes are stored and compared uppercase.
 *
 * Matching is case-insensitive at redemption, so accepting "summer10" and
 * "SUMMER10" as two separate coupons would let both exist and make which one
 * applies a coin toss.
 */
const code = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, "Code must be at least 3 characters")
  .max(50, "Code must be at most 50 characters")
  .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, hyphens and underscores only");

/** Blank optional numbers arrive as "" from a form; treat that as absent. */
const optionalMoney = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().min(0, "Can't be negative").max(9_999_999).optional()
);

const optionalCount = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().min(1, "Must be at least 1").max(1_000_000).optional()
);

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.date().optional()
);

const baseFields = {
  name: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(150, "Title must be at most 150 characters"),
  code,
  type: z.enum(COUPON_TYPES),
  value: z.coerce.number().positive("Discount must be more than zero").max(9_999_999),
  min_spend: optionalMoney,
  max_spend: optionalMoney,
  usage_limit_per_coupon: optionalCount,
  usage_limit_per_user: optionalCount,
  start_date: optionalDate,
  end_date: optionalDate,
  description: z.string().trim().max(1000).optional(),
  status: z.coerce.boolean().default(true),
};

/**
 * Cross-field rules, applied to create and update alike.
 *
 * A percentage over 100 would hand money back, and an end date before the start
 * makes a coupon that can never be used — both are typos worth catching at the
 * form rather than at redemption.
 */
function withRules<S extends z.ZodType<Record<string, unknown>>>(schema: S) {
  return schema
    .refine(
      (data) => {
        const value = data["value"];
        return data["type"] !== "percent" || value === undefined || Number(value) <= 100;
      },
      { path: ["value"], message: "A percentage can't be more than 100" }
    )
    .refine(
      (data) => {
        const start = data["start_date"];
        const end = data["end_date"];
        return !start || !end || (start as Date) <= (end as Date);
      },
      { path: ["end_date"], message: "The end date must be after the start date" }
    )
    .refine(
      (data) => {
        // Only meaningful for a fixed amount: on a percentage, max_spend is the
        // cap on the discount rather than a basket ceiling.
        const min = data["min_spend"];
        const max = data["max_spend"];
        return (
          data["type"] !== "fixed" ||
          min === undefined ||
          max === undefined ||
          Number(min) <= Number(max)
        );
      },
      { path: ["max_spend"], message: "Maximum spend must be above the minimum" }
    );
}

export const createCouponSchema = withRules(z.object(baseFields));

/**
 * Built from the same field validators with `.partial()` applied to a plain
 * object — note `status` loses its `.default(true)` here on purpose, because a
 * PATCH that doesn't mention status must leave it alone rather than switch the
 * coupon back on.
 */
export const updateCouponSchema = withRules(
  z
    .object({
      ...baseFields,
      status: z.coerce.boolean(),
    })
    .partial()
);

export const toggleCouponSchema = z.object({ status: z.coerce.boolean() });

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
