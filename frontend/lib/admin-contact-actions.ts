"use server";

import { revalidatePath } from "next/cache";

import { apiDelete, apiPatch } from "./api";
import type { ContactMessage, ContactStatus } from "./catalog";
import { getSessionToken } from "./session";

export type ContactActionResult =
  | { ok: true; notice?: string }
  | { ok: false; error: string };

export async function setContactStatusAction(
  id: number,
  status: ContactStatus
): Promise<ContactActionResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: "Your session has expired. Sign in again." };

  const result = await apiPatch<{ message: ContactMessage }>(
    `/admin/contact/${id}/status`,
    { status },
    token
  );

  if (!result.ok) return { ok: false, error: result.error };

  // The status counts above the table are derived from every row, so the page
  // has to be rebuilt rather than just the one cell being repainted.
  revalidatePath("/admin/queries");
  return { ok: true };
}

export async function deleteContactMessageAction(
  id: number
): Promise<ContactActionResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: "Your session has expired. Sign in again." };

  const result = await apiDelete<null>(`/admin/contact/${id}`, token);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/queries");
  return { ok: true, notice: "Enquiry deleted." };
}
