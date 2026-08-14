import { z } from "zod";

/** Validation for the admin's contact-enquiry list. */

export const CONTACT_STATUSES = ["pending", "working", "completed"] as const;

export type ContactStatusValue = (typeof CONTACT_STATUSES)[number];

export const CONTACT_SORTS = ["newest", "oldest"] as const;

export type ContactSort = (typeof CONTACT_SORTS)[number];

const optionalText = z.string().trim().min(1).max(120).optional().catch(undefined);

/**
 * `.catch()` on every field: this parses a query string, where a stale
 * bookmark or a hand-edited URL is a normal thing to receive. A bad `page`
 * should show page 1, not a 422.
 */
export const listContactMessagesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).default(50).catch(50),
  /** Matches name, email, phone, subject or the message body. */
  search: optionalText,
  status: z.enum(CONTACT_STATUSES).optional().catch(undefined),
  sort: z.enum(CONTACT_SORTS).default("newest").catch("newest"),
});

export type ListContactMessagesQuery = z.infer<typeof listContactMessagesSchema>;

export const updateContactStatusSchema = z.object({
  status: z.enum(CONTACT_STATUSES),
});
