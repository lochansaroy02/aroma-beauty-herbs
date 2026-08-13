import { z } from "zod";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;

export const ADMIN_ORDER_SORTS = ["newest", "oldest", "total_desc", "total_asc"] as const;

export type AdminOrderSort = (typeof ADMIN_ORDER_SORTS)[number];

const optionalText = z.string().trim().min(1).max(120).optional().catch(undefined);

export const listAdminOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).default(20).catch(20),
  /** Order number, customer name or email. */
  search: optionalText,
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
  payment_status: z.enum(PAYMENT_STATUSES).optional().catch(undefined),
  sort: z.enum(ADMIN_ORDER_SORTS).default("newest").catch("newest"),
});

export type ListAdminOrdersQuery = z.infer<typeof listAdminOrdersSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  remarks: z.string().trim().max(500).optional(),
});

/**
 * Fulfilment only moves forward. Cancelling is allowed from anywhere the goods
 * haven't shipped; refunds and returns are a separate flow that doesn't exist
 * yet, so `delivered` and `cancelled` are terminal here.
 */
export const ALLOWED_TRANSITIONS: Record<
  (typeof ORDER_STATUSES)[number],
  readonly (typeof ORDER_STATUSES)[number][]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};
