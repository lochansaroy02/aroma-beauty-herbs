import { z } from "zod";

export const INVENTORY_FILTERS = ["all", "low", "out", "in_stock"] as const;
export const INVENTORY_SORTS = [
  "stock_asc",
  "stock_desc",
  "name_asc",
  "name_desc",
  "updated",
] as const;

export type InventoryFilter = (typeof INVENTORY_FILTERS)[number];
export type InventorySort = (typeof INVENTORY_SORTS)[number];

const optionalText = z.string().trim().min(1).max(120).optional().catch(undefined);

export const listInventorySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).default(20).catch(20),
  /** Product name or SKU. */
  search: optionalText,
  filter: z.enum(INVENTORY_FILTERS).default("all").catch("all"),
  sort: z.enum(INVENTORY_SORTS).default("stock_asc").catch("stock_asc"),
});

export type ListInventoryQuery = z.infer<typeof listInventorySchema>;

/**
 * How a change is expressed.
 *
 * `set` is a physical stock count — the number in front of you replaces
 * whatever the system thought. `add` is a delivery, `remove` is damage or loss.
 * Keeping them apart means the stock ledger records intent, not just a delta.
 */
export const ADJUST_MODES = ["set", "add", "remove"] as const;
export type AdjustMode = (typeof ADJUST_MODES)[number];

export const adjustStockSchema = z.object({
  mode: z.enum(ADJUST_MODES),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  /** Shows up in the stock history, so someone can tell what happened. */
  reason: z.string().trim().max(300).optional(),
});

export const lowStockAlertSchema = z.object({
  /** Zero disables the alert for that variant. */
  low_stock_alert: z.coerce.number().int().min(0).max(1_000_000),
});
