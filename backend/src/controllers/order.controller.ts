import type { Request, Response } from "express";

import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../lib/http-error";
import { PRODUCT_MODEL_TYPE } from "../lib/media";
import { primaryImage } from "../lib/product-images";
import { prisma } from "../lib/prisma";

export const orderInclude = {
  items: {
    orderBy: { id: "asc" },
    include: { product: { select: { id: true, slug: true, product_name: true } } },
  },
  status_histories: { orderBy: { id: "asc" } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function money(value: Prisma.Decimal | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/** Images aren't joinable (media is polymorphic), so they're attached here. */
export function toOrderPayload(
  order: OrderWithRelations,
  images?: Map<number, ReturnType<typeof primaryImage>>
) {
  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    razorpay_order_id: order.razorpay_order_id,
    razorpay_payment_id: order.razorpay_payment_id,
    payment_error: order.payment_error,
    billing: {
      first_name: order.billing_first_name,
      last_name: order.billing_last_name,
      email: order.billing_email,
      phone: order.billing_phone,
      address: order.billing_address,
      city: order.billing_city,
      state: order.billing_state,
      zip: order.billing_zip,
      country: order.billing_country,
    },
    totals: {
      subtotal: money(order.subtotal),
      discount: money(order.discount),
      shipping: money(order.shipping),
      tax_total: money(order.tax_total),
      total: money(order.total),
      currency: "INR",
    },
    items: order.items.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      slug: item.product.slug,
      product_name: item.product_name,
      variant_details: item.variant_details,
      quantity: item.quantity,
      unit_price: money(item.unit_price),
      tax_rate: money(item.tax_rate),
      tax_amount: money(item.tax_amount),
      total_price: money(item.total_price),
      image: images?.get(item.product_id) ?? null,
    })),
    history: order.status_histories.map((entry) => ({
      status: entry.status,
      remarks: entry.remarks,
      at: entry.created_at,
    })),
    notes: order.notes,
    placed_at: order.created_at,
  };
}

async function imagesFor(orders: OrderWithRelations[]) {
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.product_id)))];
  const map = new Map<number, ReturnType<typeof primaryImage>>();
  if (!productIds.length) return map;

  const rows = await prisma.media.findMany({
    where: { model_type: PRODUCT_MODEL_TYPE, model_id: { in: productIds } },
    select: {
      id: true,
      model_id: true,
      file_name: true,
      name: true,
      mime_type: true,
      size: true,
      order_column: true,
      collection_name: true,
      // Needed to build the URL: a row's disk decides which endpoint serves it.
      disk: true,
      custom_properties: true,
    },
    orderBy: [{ order_column: "asc" }, { id: "asc" }],
  });

  const grouped = new Map<number, typeof rows>();
  for (const row of rows) {
    grouped.set(row.model_id, [...(grouped.get(row.model_id) ?? []), row]);
  }

  for (const [productId, group] of grouped) {
    map.set(productId, primaryImage(group));
  }

  return map;
}

/** GET /orders — the signed-in customer's own orders, newest first. */
export async function listOrders(req: Request, res: Response) {
  if (!req.auth) throw new HttpError(401, "Authentication required");

  const orders = await prisma.order.findMany({
    where: { user_id: req.auth.userId },
    include: orderInclude,
    orderBy: { id: "desc" },
    take: 50,
  });

  const images = await imagesFor(orders);

  return res.status(200).json({
    orders: orders.map((order) => toOrderPayload(order, images)),
  });
}

/** GET /orders/:orderNumber */
export async function getOrder(req: Request, res: Response) {
  if (!req.auth) throw new HttpError(401, "Authentication required");

  const raw = req.params["orderNumber"];
  const number = typeof raw === "string" ? raw.trim() : "";

  // Scoped to the caller, so someone else's order number reads as missing.
  const order = await prisma.order.findFirst({
    where: { order_number: number, user_id: req.auth.userId },
    include: orderInclude,
  });

  if (!order) throw new HttpError(404, "Order not found");

  const images = await imagesFor([order]);

  return res.status(200).json({ order: toOrderPayload(order, images) });
}
