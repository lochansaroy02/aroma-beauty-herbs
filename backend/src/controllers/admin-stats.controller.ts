import type { Request, Response } from "express";
import { z } from "zod";

import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";

/**
 * Order and revenue over time, for the dashboard chart.
 *
 * Buckets come from generate_series rather than from the orders themselves, so
 * a day with no orders is a zero in the series instead of a missing point. A
 * chart that silently closes its gaps reads as "steady" when the truth is
 * "nothing happened".
 */

const GRAINS = {
  day: { unit: "day", periods: 29 },
  week: { unit: "week", periods: 11 },
  month: { unit: "month", periods: 11 },
} as const;

type Grain = keyof typeof GRAINS;

const statsQuerySchema = z.object({
  grain: z.enum(["day", "week", "month"]).default("day"),
});

type Row = {
  bucket: Date;
  orders: bigint;
  revenue: Prisma.Decimal | null;
};

/** GET /admin/stats/orders?grain=day|week|month */
export async function getOrderStats(req: Request, res: Response) {
  const parsed = statsQuerySchema.safeParse(req.query ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const grain: Grain = parsed.data.grain;
  const { unit, periods } = GRAINS[grain];

  // `unit` is one of three literals from the enum above, never user text, so
  // Prisma.raw here cannot carry anything the schema didn't already approve.
  const truncUnit = Prisma.raw(`'${unit}'`);
  const step = Prisma.raw(`'1 ${unit}'::interval`);
  const span = Prisma.raw(`'${periods} ${unit}'::interval`);

  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    WITH series AS (
      SELECT generate_series(
        date_trunc(${truncUnit}, now()) - ${span},
        date_trunc(${truncUnit}, now()),
        ${step}
      ) AS bucket
    )
    SELECT
      s.bucket,
      COUNT(o.id) AS orders,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total ELSE 0 END), 0) AS revenue
    FROM series s
    LEFT JOIN orders o
      ON date_trunc(${truncUnit}, o.created_at) = s.bucket
    GROUP BY s.bucket
    ORDER BY s.bucket ASC
  `);

  const points = rows.map((row) => ({
    bucket: row.bucket.toISOString(),
    // COUNT returns bigint, which JSON.stringify refuses outright.
    orders: Number(row.orders),
    revenue: Number(row.revenue ?? 0),
  }));

  return res.status(200).json({
    grain,
    points,
    totals: {
      orders: points.reduce((sum, point) => sum + point.orders, 0),
      revenue: points.reduce((sum, point) => sum + point.revenue, 0),
    },
  });
}
