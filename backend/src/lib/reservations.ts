import { Prisma } from "../generated/prisma/client";
import { env } from "./env";
import { prisma } from "./prisma";

/**
 * Stock held for an unpaid order.
 *
 * Placing an order reserves stock so two shoppers can't buy the same last unit,
 * but nothing guarantees the shopper ever comes back — they close the tab, the
 * payment window dies, or (right now) Razorpay isn't configured at all and
 * there's no payment step to finish. Without an expiry those holds are
 * permanent, and the catalogue slowly reads as out of stock.
 *
 * Every transition below is a compare-and-set, because the browser callback,
 * the webhook and this sweeper can all reach the same order at once.
 */

export const RESERVATION_MINUTES = env.ORDER_RESERVATION_MINUTES;

/** How many expired orders one sweep will handle. */
const SWEEP_BATCH = 200;

type ReservedItem = { product_variant_id: number | null; quantity: number };

/**
 * Returns held stock, floored at zero.
 *
 * `GREATEST` rather than a read-then-write: a decrement that races another
 * release would otherwise drive `reserved_qty` negative, which reads as *extra*
 * availability — the worst possible direction for the error to go.
 */
export async function releaseReservation(
  tx: Prisma.TransactionClient,
  items: ReservedItem[]
): Promise<void> {
  for (const item of items) {
    if (item.product_variant_id === null) continue;

    await tx.$executeRaw`
      UPDATE product_inventory
      SET reserved_qty = GREATEST(0, reserved_qty - ${item.quantity}),
          updated_at = now()
      WHERE variant_id = ${item.product_variant_id}
    `;
  }
}

/**
 * Claims a pending order for a terminal transition, atomically.
 *
 * `updateMany` with the current state in the WHERE clause is a compare-and-set:
 * exactly one caller sees `count === 1` and is cleared to touch inventory. A
 * plain read-then-check would let two callers both pass the check.
 */
export async function claimPendingOrder(
  tx: Prisma.TransactionClient,
  orderId: number,
  data: Prisma.OrderUpdateManyMutationInput
): Promise<boolean> {
  const { count } = await tx.order.updateMany({
    // `status: pending` is the invariant that means "reservation still held".
    where: { id: orderId, status: "pending" },
    data,
  });

  return count === 1;
}

export type SweepResult = {
  released: number;
  cutoff: Date;
};

/**
 * Cancels unpaid orders past the reservation window and puts their stock back.
 *
 * Safe to run concurrently with itself and with the payment callbacks — losing
 * the claim just means somebody else got there first.
 */
export async function releaseExpiredOrders(
  minutes = RESERVATION_MINUTES
): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - minutes * 60_000);

  const expired = await prisma.order.findMany({
    where: {
      status: "pending",
      // `failed` still holds stock: the order wasn't cancelled, the payment
      // attempt just didn't land.
      payment_status: { in: ["pending", "failed"] },
      created_at: { lt: cutoff },
    },
    select: { id: true, order_number: true },
    orderBy: { id: "asc" },
    take: SWEEP_BATCH,
  });

  let released = 0;

  for (const order of expired) {
    // One transaction per order: a single poisoned row shouldn't strand the
    // whole batch.
    const done = await prisma.$transaction(async (tx) => {
      const claimed = await claimPendingOrder(tx, order.id, {
        status: "cancelled",
        payment_status: "failed",
        payment_error: `Payment not completed within ${minutes} minutes`,
      });

      if (!claimed) return false;

      const items = await tx.orderItem.findMany({
        where: { order_id: order.id },
        select: { product_variant_id: true, quantity: true },
      });

      await releaseReservation(tx, items);

      await tx.orderStatusHistory.create({
        data: {
          order_id: order.id,
          status: "cancelled",
          remarks: `Reservation expired after ${minutes} minutes`,
        },
      });

      return true;
    });

    if (done) released += 1;
  }

  return { released, cutoff };
}

let sweeping = false;

/**
 * Runs a sweep, never overlapping with one already in flight and never
 * rejecting — this is called from a timer with nowhere to report to.
 */
export async function sweepQuietly(): Promise<void> {
  if (sweeping) return;
  sweeping = true;

  try {
    const { released } = await releaseExpiredOrders();
    if (released > 0) {
      console.log(`Released stock from ${released} expired order(s)`);
    }
  } catch (error) {
    console.error("Reservation sweep failed:", error);
  } finally {
    sweeping = false;
  }
}
