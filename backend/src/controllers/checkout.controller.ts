import type { Request, Response } from "express";
import { z } from "zod";

import { Prisma } from "../generated/prisma/client";
import { availableQty, productInclude } from "../lib/catalog";
import { env, isRazorpayConfigured } from "../lib/env";
import { HttpError } from "../lib/http-error";
import {
  FREE_SHIPPING_OVER,
  SHIPPING_FLAT_RATE,
  lineTotals,
  orderTotals,
  type LineTotals,
} from "../lib/pricing";
import { prisma } from "../lib/prisma";
import { claimPendingOrder, releaseReservation } from "../lib/reservations";
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "../lib/razorpay";
import {
  cancelPaymentSchema,
  checkoutSchema,
  verifyPaymentSchema,
  type CheckoutInput,
} from "../schemas/checkout.schema";
import { toOrderPayload, orderInclude } from "./order.controller";

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, "Authentication required");
  return req.auth.userId;
}

/**
 * ABH-250810-4F2A: date-stamped so support can eyeball when an order was
 * placed, with a random tail because a sequence would leak volume.
 */
function orderNumber(): string {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");

  const tail = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ABH-${stamp}-${tail}`;
}

const cartInclude = {
  product: { include: productInclude },
  variant: {
    select: {
      id: true,
      sku: true,
      variation_name: true,
      price: { select: { sale_price: true, tax_percentage: true } },
      inventory: { select: { stock_qty: true, reserved_qty: true } },
    },
  },
} satisfies Prisma.CartItemInclude;

type CartRow = Prisma.CartItemGetPayload<{ include: typeof cartInclude }>;

type PricedLine = {
  row: CartRow;
  totals: LineTotals;
};

/**
 * Re-prices the cart from live data and refuses anything that can't be
 * fulfilled. Never trust the totals the browser had on screen.
 */
function priceCart(rows: CartRow[]): PricedLine[] {
  if (!rows.length) {
    throw new HttpError(409, "Your cart is empty");
  }

  return rows.map((row) => {
    const name = row.product.product_name;

    if (row.product.deleted_at !== null || row.product.status !== 1) {
      throw new HttpError(409, `"${name}" is no longer available. Remove it to continue.`);
    }

    if (!row.variant) {
      throw new HttpError(409, `"${name}" has no option selected. Remove it and add it again.`);
    }

    const available = availableQty(row.variant);
    if (available < row.quantity) {
      throw new HttpError(
        409,
        available === 0
          ? `"${name}" is out of stock. Remove it to continue.`
          : `Only ${available} of "${name}" left. Lower the quantity to continue.`
      );
    }

    const price = row.variant.price;
    if (!price) {
      throw new HttpError(409, `"${name}" isn't priced yet. Remove it to continue.`);
    }

    return {
      row,
      totals: lineTotals({
        unitPrice: Number(price.sale_price),
        quantity: row.quantity,
        taxPercentage: Number(price.tax_percentage ?? 0),
      }),
    };
  });
}

function variantLabel(row: CartRow): string | null {
  const name = row.variant?.variation_name;
  return name && name !== "Default" ? name : null;
}

/** The payment block the browser needs to open Razorpay's widget. */
function paymentPayload(order: { razorpay_order_id: string | null; total: Prisma.Decimal }) {
  return {
    provider: "razorpay" as const,
    configured: isRazorpayConfigured,
    key_id: isRazorpayConfigured ? env.RAZORPAY_KEY_ID : null,
    razorpay_order_id: order.razorpay_order_id,
    amount: Number(order.total),
    currency: "INR",
  };
}

/**
 * GET /checkout/config — so the UI can say whether card payment is live rather
 * than discovering it when the payment window fails to open.
 */
export async function getCheckoutConfig(_req: Request, res: Response) {
  return res.status(200).json({
    razorpay_configured: isRazorpayConfigured,
    // The mirror image: test payments exist exactly while Razorpay doesn't.
    test_payments_enabled: !isRazorpayConfigured,
    shipping: { flat_rate: SHIPPING_FLAT_RATE, free_over: FREE_SHIPPING_OVER },
    currency: "INR",
  });
}

/**
 * POST /checkout — turns the cart into an order.
 *
 * Stock is *reserved* here, not deducted: the sale isn't real until the payment
 * clears. Verification converts the reservation into a stock movement, and
 * cancelling releases it. The cart is left alone until payment succeeds, so an
 * abandoned attempt doesn't cost the shopper their basket.
 */
export async function createCheckout(req: Request, res: Response) {
  const user = userId(req);
  const parsed = checkoutSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const input: CheckoutInput = parsed.data;

  const rows = await prisma.cartItem.findMany({
    where: { user_id: user },
    include: cartInclude,
    orderBy: { id: "asc" },
  });

  const lines = priceCart(rows);
  const totals = orderTotals(lines.map((line) => line.totals));

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        order_number: orderNumber(),
        user_id: user,
        status: "pending",
        billing_first_name: input.first_name,
        billing_last_name: input.last_name,
        billing_email: input.email,
        billing_phone: input.phone,
        billing_address: [input.address_line_1, input.address_line_2]
          .filter(Boolean)
          .join(", "),
        billing_city: input.city,
        billing_state: input.state,
        billing_zip: input.zip,
        billing_country: input.country,
        subtotal: new Prisma.Decimal(totals.subtotal),
        discount: new Prisma.Decimal(totals.discount),
        shipping: new Prisma.Decimal(totals.shipping),
        tax_total: new Prisma.Decimal(totals.taxTotal),
        total: new Prisma.Decimal(totals.total),
        payment_method: "razorpay",
        payment_status: "pending",
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });

    for (const { row, totals: line } of lines) {
      await tx.orderItem.create({
        data: {
          order_id: created.id,
          product_id: row.product_id,
          product_variant_id: row.product_variant_id,
          product_name: row.product.product_name,
          variant_details: variantLabel(row),
          quantity: row.quantity,
          rate_include_gst: new Prisma.Decimal(line.rateIncludeGst),
          rate_exclude_gst: new Prisma.Decimal(line.rateExcludeGst),
          gst_rate: new Prisma.Decimal(line.gstRate),
          include_gst_total: new Prisma.Decimal(line.includeGstTotal),
          exclude_gst_total: new Prisma.Decimal(line.excludeGstTotal),
          tax_rate: new Prisma.Decimal(line.gstRate),
          tax_amount: new Prisma.Decimal(line.taxAmount),
          unit_price: new Prisma.Decimal(line.unitPrice),
          total_price: new Prisma.Decimal(line.totalPrice),
        },
      });

      // Hold the stock so two shoppers can't buy the same last unit.
      await tx.productInventory.update({
        where: { variant_id: row.product_variant_id! },
        data: { reserved_qty: { increment: row.quantity } },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        order_id: created.id,
        status: "pending",
        remarks: "Order placed, awaiting payment",
        user_id: user,
      },
    });

    if (input.save_address) {
      await tx.userAddress.create({
        data: {
          user_id: user,
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          phone: input.phone,
          address_line_1: input.address_line_1,
          address_line_2: input.address_line_2 ?? null,
          city: input.city,
          state: input.state,
          zip_code: input.zip,
          country: input.country,
        },
      });
    }

    return created;
  });

  // Razorpay comes after the transaction: a network call has no place holding
  // database locks, and a failure here leaves a recoverable pending order.
  let razorpayOrderId: string | null = null;

  if (isRazorpayConfigured) {
    try {
      const remote = await createRazorpayOrder({
        amount: totals.total,
        receipt: order.order_number,
        notes: { order_number: order.order_number, user_id: String(user) },
      });

      razorpayOrderId = remote.id;
      await prisma.order.update({
        where: { id: order.id },
        data: { razorpay_order_id: remote.id },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Razorpay order failed";
      await prisma.order.update({
        where: { id: order.id },
        data: { payment_error: message },
      });

      throw new HttpError(
        502,
        "Couldn't reach the payment provider. Your order is saved — try paying again from your orders page."
      );
    }
  }

  const full = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: orderInclude,
  });

  return res.status(201).json({
    order: toOrderPayload(full),
    payment: paymentPayload({ razorpay_order_id: razorpayOrderId, total: order.total }),
  });
}

async function findPendingOrder(user: number, orderNumberParam: unknown) {
  const number = typeof orderNumberParam === "string" ? orderNumberParam.trim() : "";
  if (!number) throw new HttpError(400, "Order number is required");

  const order = await prisma.order.findFirst({
    where: { order_number: number, user_id: user },
    include: { items: true },
  });

  if (!order) throw new HttpError(404, "Order not found");
  return order;
}

/** Converts held stock into a real movement. Runs once, when payment clears. */
async function commitInventory(
  tx: Prisma.TransactionClient,
  items: { product_variant_id: number | null; product_id: number; quantity: number }[],
  orderId: number
) {
  for (const item of items) {
    if (item.product_variant_id === null) continue;

    const inventory = await tx.productInventory.findUnique({
      where: { variant_id: item.product_variant_id },
      select: { stock_qty: true },
    });

    const before = inventory?.stock_qty ?? 0;
    const after = before - item.quantity;

    // reserved_qty is floored: the sweeper may already have released this hold
    // if the payment arrived right on the deadline.
    await tx.$executeRaw`
      UPDATE product_inventory
      SET stock_qty = stock_qty - ${item.quantity},
          reserved_qty = GREATEST(0, reserved_qty - ${item.quantity}),
          updated_at = now()
      WHERE variant_id = ${item.product_variant_id}
    `;

    await tx.stockTransaction.create({
      data: {
        variant_id: item.product_variant_id,
        product_id: item.product_id,
        type: "OUT",
        reference_type: "order",
        reference_id: orderId,
        qty: new Prisma.Decimal(item.quantity),
        stock_before: new Prisma.Decimal(before),
        stock_after: new Prisma.Decimal(after),
      },
    });
  }
}

export type PaidOutcome = "confirmed" | "already_confirmed" | "cancelled_before_payment";

/**
 * Marks an order paid. Shared by the browser callback and the webhook, which
 * race by design — the claim below decides which one actually does the work.
 */
async function markPaid(
  orderId: number,
  paymentId: string,
  actorId: number | null
): Promise<PaidOutcome> {
  return prisma.$transaction(async (tx) => {
    const claimed = await claimPendingOrder(tx, orderId, {
      status: "confirmed",
      payment_status: "paid",
      razorpay_payment_id: paymentId,
      payment_error: null,
    });

    if (!claimed) {
      const current = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { payment_status: true },
      });

      if (current.payment_status === "paid") return "already_confirmed";

      // Money captured for an order that had already been cancelled — usually
      // a payment landing just after the reservation expired. The stock is
      // gone, so this needs a person and a refund, not a silent confirmation.
      await tx.order.update({
        where: { id: orderId },
        data: {
          razorpay_payment_id: paymentId,
          payment_error: `Payment ${paymentId} captured after the order was cancelled — refund required`,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          order_id: orderId,
          status: "cancelled",
          remarks: `Late payment captured (${paymentId}) — needs refund`,
          user_id: actorId,
        },
      });

      return "cancelled_before_payment";
    }

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    await commitInventory(tx, order.items, order.id);

    await tx.orderStatusHistory.create({
      data: {
        order_id: order.id,
        status: "confirmed",
        remarks: `Payment captured (${paymentId})`,
        user_id: actorId,
      },
    });

    // The basket has become an order; only now is it safe to empty it.
    if (order.user_id !== null) {
      await tx.cartItem.deleteMany({ where: { user_id: order.user_id } });
    }

    return "confirmed";
  });
}

/**
 * POST /checkout/:orderNumber/simulate — marks an order paid with no payment.
 *
 * Exists so the order features can be exercised before the business is verified
 * with Razorpay. It runs the real `markPaid` path, so inventory commits and the
 * cart empties exactly as they will in production.
 *
 * It disables itself: the moment RAZORPAY_KEY_ID looks like a real key this
 * returns 403. There is no env flag to force it on, so it cannot be left
 * switched on by accident once payments go live.
 */
export async function simulatePayment(req: Request, res: Response) {
  if (isRazorpayConfigured) {
    throw new HttpError(
      403,
      "Razorpay is configured — test payments are disabled. Use the real payment flow."
    );
  }

  const user = userId(req);
  const order = await findPendingOrder(user, req.params["orderNumber"]);

  if (order.payment_status === "paid") {
    throw new HttpError(409, "That order is already paid");
  }

  if (order.status === "cancelled") {
    throw new HttpError(409, "That order was cancelled");
  }

  // Obviously fake, and greppable if one ever turns up in real data.
  const paymentId = `pay_TEST_${Date.now().toString(36).toUpperCase()}`;
  const outcome = await markPaid(order.id, paymentId, user);

  if (outcome === "cancelled_before_payment") {
    throw new HttpError(409, "That order expired before it could be marked paid");
  }

  const full = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: orderInclude,
  });

  return res.status(200).json({ order: toOrderPayload(full), simulated: true });
}

/** POST /checkout/:orderNumber/verify — the browser's success callback. */
export async function verifyCheckoutPayment(req: Request, res: Response) {
  const user = userId(req);
  const parsed = verifyPaymentSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const order = await findPendingOrder(user, req.params["orderNumber"]);
  const body = parsed.data;

  if (order.razorpay_order_id && order.razorpay_order_id !== body.razorpay_order_id) {
    throw new HttpError(409, "That payment belongs to a different order");
  }

  const valid = verifyPaymentSignature({
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });

  if (!valid) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        payment_status: "failed",
        payment_error: "Signature verification failed",
      },
    });

    throw new HttpError(400, "We couldn't verify that payment. Nothing has been charged.");
  }

  const outcome = await markPaid(order.id, body.razorpay_payment_id, user);

  if (outcome === "cancelled_before_payment") {
    throw new HttpError(
      409,
      "This order expired before the payment came through. It's been flagged for a refund — please contact us."
    );
  }

  const full = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: orderInclude,
  });

  return res.status(200).json({ order: toOrderPayload(full) });
}

/**
 * POST /checkout/:orderNumber/cancel — the widget was dismissed or errored.
 * Releases the held stock so it isn't stranded until someone notices.
 */
export async function cancelCheckout(req: Request, res: Response) {
  const user = userId(req);
  const parsed = cancelPaymentSchema.safeParse(req.body ?? {});
  const reason = parsed.success ? parsed.data.reason : undefined;

  const order = await findPendingOrder(user, req.params["orderNumber"]);

  if (order.payment_status === "paid") {
    throw new HttpError(409, "That order is already paid");
  }

  await prisma.$transaction(async (tx) => {
    // Claim first, release second. If the sweeper or a webhook already moved
    // this order on, the stock is not ours to hand back a second time.
    const claimed = await claimPendingOrder(tx, order.id, {
      status: "cancelled",
      payment_status: "failed",
      payment_error: reason ?? "Payment was not completed",
    });

    if (!claimed) return;

    await releaseReservation(tx, order.items);

    await tx.orderStatusHistory.create({
      data: {
        order_id: order.id,
        status: "cancelled",
        remarks: reason ?? "Payment not completed",
        user_id: user,
      },
    });
  });

  return res.status(200).json({ cancelled: order.order_number });
}

/**
 * POST /checkout/webhook — Razorpay's server-to-server notification.
 *
 * The authoritative path: the browser callback can be lost to a closed tab or a
 * flaky network, this can't. Mounted with a raw body parser because the
 * signature covers the exact bytes sent.
 */
export async function razorpayWebhook(req: Request, res: Response) {
  const signature = req.headers["x-razorpay-signature"];
  const raw = req.body;

  if (typeof signature !== "string" || !Buffer.isBuffer(raw)) {
    throw new HttpError(400, "Malformed webhook");
  }

  if (!verifyWebhookSignature(raw, signature)) {
    // Also the answer when no webhook secret is set — an unsigned call is not
    // something to act on.
    throw new HttpError(401, "Invalid webhook signature");
  }

  const event = JSON.parse(raw.toString("utf8")) as {
    event?: string;
    payload?: {
      payment?: {
        entity?: { id?: string; order_id?: string; error_description?: string };
      };
    };
  };

  const payment = event.payload?.payment?.entity;

  if (!payment?.order_id || !payment.id) {
    // Nothing actionable, but a 200 stops Razorpay retrying forever.
    return res.status(200).json({ ignored: true });
  }

  const order = await prisma.order.findFirst({
    where: { razorpay_order_id: payment.order_id },
    select: { id: true },
  });

  if (!order) return res.status(200).json({ ignored: true });

  if (event.event === "payment.captured") {
    const outcome = await markPaid(order.id, payment.id, null);

    if (outcome === "cancelled_before_payment") {
      // 200 regardless — Razorpay retrying won't fix it, a human refunding will.
      console.error(
        `Razorpay captured ${payment.id} for cancelled order ${order.id}. Refund required.`
      );
    }
  } else if (event.event === "payment.failed") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        payment_status: "failed",
        payment_error: payment.error_description ?? "Payment failed",
      },
    });
  }

  return res.status(200).json({ received: true });
}

/**
 * POST /checkout/:orderNumber/retry — a fresh Razorpay order for a payment that
 * didn't go through, without making the shopper rebuild their basket.
 */
export async function retryCheckoutPayment(req: Request, res: Response) {
  const user = userId(req);
  const order = await findPendingOrder(user, req.params["orderNumber"]);

  if (order.payment_status === "paid") {
    throw new HttpError(409, "That order is already paid");
  }

  if (order.status === "cancelled") {
    throw new HttpError(409, "That order was cancelled. Add the items to your cart again.");
  }

  const remote = await createRazorpayOrder({
    amount: Number(order.total),
    receipt: order.order_number,
    notes: { order_number: order.order_number, user_id: String(user) },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      razorpay_order_id: remote.id,
      payment_status: "pending",
      payment_error: null,
    },
  });

  return res.status(200).json({
    payment: paymentPayload({ razorpay_order_id: remote.id, total: order.total }),
  });
}
