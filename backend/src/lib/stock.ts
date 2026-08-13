import { Prisma } from "../generated/prisma/client";
import { HttpError } from "./http-error";
import type { AdjustMode } from "../schemas/inventory.schema";

/** What a mode does to the count, and how it's filed in the ledger. */
const TRANSACTION_TYPE: Record<AdjustMode, "IN" | "OUT" | "ADJUSTMENT"> = {
  add: "IN",
  remove: "OUT",
  set: "ADJUSTMENT",
};

export type StockChange = {
  before: number;
  after: number;
  reserved: number;
};

/**
 * The single place stock counts move.
 *
 * Takes a `tx` rather than opening its own transaction so a caller that is
 * already mid-transaction — the product editor, saving price and stock together
 * — commits the count and its ledger row atomically with everything else.
 *
 * The row is locked for the duration: read-then-write is a race, and two people
 * counting the same shelf would otherwise both write from the same starting
 * number and one update would silently vanish.
 */
export async function applyStockChange(
  tx: Prisma.TransactionClient,
  input: {
    variantId: number;
    productId: number;
    mode: AdjustMode;
    quantity: number;
    actorId: number | null;
    notes: string;
    /** Defaults to "manual"; orders pass their own so the ledger reads right. */
    referenceType?: string;
    referenceId?: number;
  }
): Promise<StockChange> {
  const locked = await tx.$queryRaw<
    { stock_qty: number; reserved_qty: number; low_stock_alert: number }[]
  >`
    SELECT stock_qty, reserved_qty, low_stock_alert
    FROM product_inventory
    WHERE variant_id = ${input.variantId}
    FOR UPDATE
  `;

  const current = locked[0];
  const before = current?.stock_qty ?? 0;
  const reserved = current?.reserved_qty ?? 0;

  let after: number;
  if (input.mode === "set") after = input.quantity;
  else if (input.mode === "add") after = before + input.quantity;
  else after = before - input.quantity;

  if (after < 0) {
    throw new HttpError(409, `Can't remove ${input.quantity} — only ${before} in stock.`);
  }

  if (!current) {
    // A variant created before inventory tracking, or by an import.
    await tx.productInventory.create({
      data: {
        variant_id: input.variantId,
        stock_qty: after,
        reserved_qty: 0,
        low_stock_alert: 0,
      },
    });
  } else {
    await tx.productInventory.update({
      where: { variant_id: input.variantId },
      data: { stock_qty: after },
    });
  }

  await tx.stockTransaction.create({
    data: {
      variant_id: input.variantId,
      product_id: input.productId,
      type: TRANSACTION_TYPE[input.mode],
      reference_type: input.referenceType ?? "manual",
      ...(input.referenceId === undefined ? {} : { reference_id: input.referenceId }),
      created_by_id: input.actorId,
      qty: new Prisma.Decimal(
        input.mode === "set" ? Math.abs(after - before) : input.quantity
      ),
      stock_before: new Prisma.Decimal(before),
      stock_after: new Prisma.Decimal(after),
      notes: input.notes,
    },
  });

  return { before, after, reserved };
}
