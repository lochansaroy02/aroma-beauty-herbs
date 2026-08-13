import type { Request, Response } from "express";
import { z } from "zod";

import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { claimPendingOrder, releaseReservation } from "../lib/reservations";
import {
  ALLOWED_TRANSITIONS,
  listAdminOrdersSchema,
  updateOrderStatusSchema,
  type AdminOrderSort,
} from "../schemas/admin-order.schema";
import { orderInclude, toOrderPayload } from "./order.controller";

function adminId(req: Request): number {
  if (!req.auth) throw new HttpError(401, "Authentication required");
  return req.auth.userId;
}

const ORDER_BY: Record<AdminOrderSort, Prisma.OrderOrderByWithRelationInput[]> = {
  newest: [{ created_at: "desc" }, { id: "desc" }],
  oldest: [{ created_at: "asc" }, { id: "asc" }],
  total_desc: [{ total: "desc" }, { id: "desc" }],
  total_asc: [{ total: "asc" }, { id: "desc" }],
};

/**
 * The list only needs enough to fill a row, so items are counted and summed
 * rather than loaded — an orders table shouldn't drag every line item with it.
 */
const rowSelect = {
  id: true,
  order_number: true,
  status: true,
  payment_status: true,
  payment_method: true,
  billing_first_name: true,
  billing_last_name: true,
  billing_email: true,
  billing_phone: true,
  total: true,
  created_at: true,
  items: { select: { quantity: true } },
  user: { select: { id: true, email: true, name: true } },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof rowSelect }>;

function toRow(order: OrderRow) {
  return {
    id: order.id,
    order_number: order.order_number,
    customer_name: `${order.billing_first_name} ${order.billing_last_name}`.trim(),
    customer_email: order.billing_email,
    customer_phone: order.billing_phone,
    /** Units ordered, plus how many distinct lines they came from. */
    item_count: order.items.reduce((sum, item) => sum + item.quantity, 0),
    line_count: order.items.length,
    total: Number(order.total),
    currency: "INR",
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    status: order.status,
    placed_at: order.created_at,
    /** Set when the order has no account behind it (guest or deleted user). */
    account_email: order.user?.email ?? null,
  };
}

/** GET /admin/orders */
export async function listAdminOrders(req: Request, res: Response) {
  const query = listAdminOrdersSchema.parse(req.query);

  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.payment_status ? { payment_status: query.payment_status } : {}),
    ...(query.search
      ? {
          OR: [
            { order_number: { contains: query.search, mode: "insensitive" } },
            { billing_first_name: { contains: query.search, mode: "insensitive" } },
            { billing_last_name: { contains: query.search, mode: "insensitive" } },
            { billing_email: { contains: query.search, mode: "insensitive" } },
            { billing_phone: { contains: query.search } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, orders, revenue, awaiting] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: rowSelect,
      orderBy: ORDER_BY[query.sort],
      skip,
      take: query.limit,
    }),
    // Headline figures cover the whole book, not the current page.
    prisma.order.aggregate({ where: { payment_status: "paid" }, _sum: { total: true } }),
    prisma.order.count({ where: { status: "pending" } }),
  ]);

  return res.status(200).json({
    orders: orders.map(toRow),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.limit)),
      has_more: skip + orders.length < total,
    },
    summary: {
      paid_revenue: Number(revenue._sum.total ?? 0),
      awaiting_payment: awaiting,
      currency: "INR",
    },
    applied: {
      search: query.search ?? null,
      status: query.status ?? null,
      payment_status: query.payment_status ?? null,
      sort: query.sort,
    },
  });
}

async function findOrder(orderNumberParam: unknown) {
  const number = typeof orderNumberParam === "string" ? orderNumberParam.trim() : "";
  if (!number) throw new HttpError(400, "Order number is required");

  const order = await prisma.order.findUnique({
    where: { order_number: number },
    include: orderInclude,
  });

  if (!order) throw new HttpError(404, "Order not found");
  return order;
}

/** GET /admin/orders/:orderNumber */
export async function getAdminOrder(req: Request, res: Response) {
  adminId(req);
  const order = await findOrder(req.params["orderNumber"]);

  return res.status(200).json({
    order: {
      ...toOrderPayload(order),
      customer: order.user_id
        ? await prisma.user.findUnique({
            where: { id: order.user_id },
            select: { id: true, name: true, email: true, phone: true },
          })
        : null,
    },
  });
}

/**
 * PATCH /admin/orders/:orderNumber/status
 *
 * Fulfilment tracking. Cancelling an unpaid order gives its reserved stock
 * back; cancelling a paid one would be a refund, which isn't built, so it's
 * refused rather than quietly leaving money unaccounted for.
 */
export async function updateOrderStatus(req: Request, res: Response) {
  const admin = adminId(req);
  const parsed = updateOrderStatusSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const order = await findOrder(req.params["orderNumber"]);
  const { status, remarks } = parsed.data;

  if (status === order.status) {
    throw new HttpError(409, `This order is already ${status}`);
  }

  const allowed = ALLOWED_TRANSITIONS[order.status];

  if (!allowed.includes(status)) {
    throw new HttpError(
      409,
      allowed.length === 0
        ? `A ${order.status} order can't change status`
        : `A ${order.status} order can only move to ${allowed.join(" or ")}`
    );
  }

  const cancelling = status === "cancelled";

  if (cancelling && order.payment_status === "paid") {
    throw new HttpError(
      409,
      "This order is paid. Refunds aren't built yet — refund in the Razorpay dashboard first."
    );
  }

  await prisma.$transaction(async (tx) => {
    if (cancelling && order.status === "pending") {
      // Same compare-and-set the sweeper uses, so a cancel racing the sweep
      // can't release the same reservation twice.
      const claimed = await claimPendingOrder(tx, order.id, {
        status: "cancelled",
        payment_status: "failed",
        payment_error: remarks ?? "Cancelled by staff",
      });

      if (claimed) {
        await releaseReservation(tx, order.items);
      }
    } else {
      await tx.order.update({ where: { id: order.id }, data: { status } });
    }

    await tx.orderStatusHistory.create({
      data: {
        order_id: order.id,
        status,
        remarks: remarks ?? `Marked ${status} by staff`,
        user_id: admin,
      },
    });
  });

  const updated = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: orderInclude,
  });

  return res.status(200).json({ order: toOrderPayload(updated) });
}
