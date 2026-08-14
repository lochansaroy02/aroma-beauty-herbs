import type { Request, Response } from "express";
import { z } from "zod";

import { COUPON_ACTIVE, COUPON_INACTIVE } from "../lib/coupons";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import {
  createCouponSchema,
  listCouponsSchema,
  toggleCouponSchema,
  updateCouponSchema,
} from "../schemas/admin-coupon.schema";

/** Coupon management. Redemption rules live in lib/coupons.ts. */

const rowSelect = {
  id: true,
  name: true,
  code: true,
  type: true,
  value: true,
  min_spend: true,
  max_spend: true,
  usage_limit_per_coupon: true,
  usage_limit_per_user: true,
  usage_count: true,
  start_date: true,
  end_date: true,
  description: true,
  status: true,
  created_at: true,
} satisfies Prisma.CouponSelect;

type CouponRow = Prisma.CouponGetPayload<{ select: typeof rowSelect }>;

/** Decimals and the Int status become plain JSON the browser can use. */
function toPayload(row: CouponRow) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.type,
    value: Number(row.value),
    min_spend: row.min_spend === null ? null : Number(row.min_spend),
    max_spend: row.max_spend === null ? null : Number(row.max_spend),
    usage_limit_per_coupon: row.usage_limit_per_coupon,
    usage_limit_per_user: row.usage_limit_per_user,
    usage_count: row.usage_count,
    start_date: row.start_date,
    end_date: row.end_date,
    description: row.description,
    is_active: row.status === COUPON_ACTIVE,
    created_at: row.created_at,
  };
}

function parseOrThrow<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

async function couponId(req: Request): Promise<number> {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid coupon id");

  const existing = await prisma.coupon.findFirst({
    where: { id, deleted_at: null },
    select: { id: true },
  });

  if (!existing) throw new HttpError(404, "Coupon not found");
  return existing.id;
}

/** GET /admin/coupons */
export async function listCoupons(req: Request, res: Response) {
  const query = listCouponsSchema.parse(req.query);

  const where: Prisma.CouponWhereInput = {
    deleted_at: null,
    ...(query.status
      ? { status: query.status === "active" ? COUPON_ACTIVE : COUPON_INACTIVE }
      : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { code: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, coupons, active] = await Promise.all([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      select: rowSelect,
      orderBy: { id: "desc" },
      skip,
      take: query.limit,
    }),
    prisma.coupon.count({ where: { deleted_at: null, status: COUPON_ACTIVE } }),
  ]);

  return res.status(200).json({
    coupons: coupons.map(toPayload),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.limit)),
      has_more: skip + coupons.length < total,
    },
    summary: { active, inactive: total - active, total },
    applied: {
      search: query.search ?? null,
      status: query.status ?? null,
      limit: query.limit,
    },
  });
}

/** Turns a duplicate-code database error into the field message the form wants. */
function rethrowDuplicate(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new HttpError(422, "Validation failed", {
      code: ["That code is already in use"],
    });
  }
  throw error;
}

/** POST /admin/coupons */
export async function createCoupon(req: Request, res: Response) {
  const input = parseOrThrow(createCouponSchema, req.body);

  const coupon = await prisma.coupon
    .create({
      data: {
        name: input.name,
        code: input.code,
        type: input.type,
        value: new Prisma.Decimal(input.value),
        min_spend: input.min_spend === undefined ? null : new Prisma.Decimal(input.min_spend),
        max_spend: input.max_spend === undefined ? null : new Prisma.Decimal(input.max_spend),
        usage_limit_per_coupon: input.usage_limit_per_coupon ?? null,
        usage_limit_per_user: input.usage_limit_per_user ?? null,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        description: input.description || null,
        status: input.status ? COUPON_ACTIVE : COUPON_INACTIVE,
        created_by_id: req.auth?.userId ?? null,
      },
      select: rowSelect,
    })
    .catch(rethrowDuplicate);

  return res.status(201).json({ coupon: toPayload(coupon) });
}

/** PATCH /admin/coupons/:id */
export async function updateCoupon(req: Request, res: Response) {
  const id = await couponId(req);
  const input = parseOrThrow(updateCouponSchema, req.body);

  const coupon = await prisma.coupon
    .update({
      where: { id },
      // `undefined` leaves a column alone; the nullable ones need an explicit
      // null to be cleared, which is what "No minimum" in the form means.
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.value !== undefined ? { value: new Prisma.Decimal(input.value) } : {}),
        ...("min_spend" in input
          ? {
              min_spend:
                input.min_spend === undefined ? null : new Prisma.Decimal(input.min_spend),
            }
          : {}),
        ...("max_spend" in input
          ? {
              max_spend:
                input.max_spend === undefined ? null : new Prisma.Decimal(input.max_spend),
            }
          : {}),
        ...("usage_limit_per_coupon" in input
          ? { usage_limit_per_coupon: input.usage_limit_per_coupon ?? null }
          : {}),
        ...("usage_limit_per_user" in input
          ? { usage_limit_per_user: input.usage_limit_per_user ?? null }
          : {}),
        ...("start_date" in input ? { start_date: input.start_date ?? null } : {}),
        ...("end_date" in input ? { end_date: input.end_date ?? null } : {}),
        ...("description" in input ? { description: input.description || null } : {}),
        ...(input.status !== undefined
          ? { status: input.status ? COUPON_ACTIVE : COUPON_INACTIVE }
          : {}),
      },
      select: rowSelect,
    })
    .catch(rethrowDuplicate);

  return res.status(200).json({ coupon: toPayload(coupon) });
}

/** PATCH /admin/coupons/:id/status — the toggle in the list. */
export async function toggleCouponStatus(req: Request, res: Response) {
  const id = await couponId(req);
  const input = parseOrThrow(toggleCouponSchema, req.body);

  const coupon = await prisma.coupon.update({
    where: { id },
    data: { status: input.status ? COUPON_ACTIVE : COUPON_INACTIVE },
    select: rowSelect,
  });

  return res.status(200).json({ coupon: toPayload(coupon) });
}

/** DELETE /admin/coupons/:id */
export async function deleteCoupon(req: Request, res: Response) {
  const id = await couponId(req);

  /**
   * Soft delete. Orders reference the coupon they were placed with, and a hard
   * delete would either break that foreign key or quietly detach a past order
   * from the offer it was sold under — which is a record the business needs.
   */
  await prisma.coupon.update({
    where: { id },
    data: { deleted_at: new Date(), status: COUPON_INACTIVE },
  });

  return res.status(204).send();
}
