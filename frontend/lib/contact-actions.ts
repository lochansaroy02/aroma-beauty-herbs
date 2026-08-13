"use server";

import { apiPost } from "./api";
import type { FieldErrors } from "./api";

export type ContactInput = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  /** Honeypot — a real person never sees the field, so anything here is a bot. */
  website: string;
};

export type ContactResult =
  | { ok: true; reference: number | null }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/**
 * Posts an enquiry. The API stores it before it tries to email anyone, so a
 * success here means the message is safe even if the notification never lands.
 */
export async function sendContactAction(input: ContactInput): Promise<ContactResult> {
  const result = await apiPost<{ received: boolean; reference?: number }>(
    "/contact",
    input
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      ...(result.status === 422 ? { fieldErrors: result.details as FieldErrors } : {}),
    };
  }

  return { ok: true, reference: result.data.reference ?? null };
}
