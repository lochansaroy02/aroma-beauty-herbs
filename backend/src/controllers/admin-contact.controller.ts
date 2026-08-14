import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import type { Prisma } from "../generated/prisma/client";
import {
  CONTACT_STATUSES,
  listContactMessagesSchema,
  updateContactStatusSchema,
} from "../schemas/admin-contact.schema";

/**
 * Contact-form enquiries, for staff.
 *
 * The public side is contact.controller.ts, which only ever writes. This is the
 * read-and-triage half: everything that came in, when, and how far along it is.
 */

const rowSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  subject: true,
  message: true,
  status: true,
  notified: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.ContactMessageSelect;

const ORDER_BY: Record<string, Prisma.ContactMessageOrderByWithRelationInput> = {
  newest: { id: "desc" },
  oldest: { id: "asc" },
};

/** GET /admin/contact */
export async function listContactMessages(req: Request, res: Response) {
  const query = listContactMessagesSchema.parse(req.query);

  const where: Prisma.ContactMessageWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search } },
            { subject: { contains: query.search, mode: "insensitive" } },
            { message: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, messages, grouped] = await Promise.all([
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.findMany({
      where,
      select: rowSelect,
      orderBy: ORDER_BY[query.sort] ?? ORDER_BY["newest"],
      skip,
      take: query.limit,
    }),
    // Counts cover everything, not the filtered page — they are what the tabs
    // are for, and a count that changed with the filter would be circular.
    prisma.contactMessage.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts: Record<string, number> = { pending: 0, working: 0, completed: 0 };
  for (const row of grouped) counts[row.status] = row._count._all;

  return res.status(200).json({
    messages,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.limit)),
      has_more: skip + messages.length < total,
    },
    counts: {
      ...counts,
      all: Object.values(counts).reduce((sum, value) => sum + value, 0),
    },
    applied: {
      search: query.search ?? null,
      status: query.status ?? null,
      sort: query.sort,
      limit: query.limit,
    },
  });
}

function messageId(req: Request): number {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid message id");
  return id;
}

/** PATCH /admin/contact/:id/status */
export async function updateContactStatus(req: Request, res: Response) {
  const id = messageId(req);
  const parsed = updateContactStatusSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors);
  }

  const existing = await prisma.contactMessage.findUnique({
    where: { id },
    select: { id: true },
  });

  // Checked first so a stale row reads as 404 rather than Prisma's P2025.
  if (!existing) throw new HttpError(404, "Message not found");

  const message = await prisma.contactMessage.update({
    where: { id },
    data: { status: parsed.data.status },
    select: rowSelect,
  });

  return res.status(200).json({ message });
}

/** DELETE /admin/contact/:id */
export async function deleteContactMessage(req: Request, res: Response) {
  const id = messageId(req);

  const existing = await prisma.contactMessage.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) throw new HttpError(404, "Message not found");

  // A hard delete: there is no soft-delete column on this table, and an
  // enquiry someone chose to remove is usually spam they don't want kept.
  await prisma.contactMessage.delete({ where: { id } });

  return res.status(204).send();
}

/** Exported so the route file can't drift from the schema's list. */
export { CONTACT_STATUSES };
