"use server";

import { revalidatePath } from "next/cache";

import { apiPost } from "./api";
import { getSessionToken } from "./session";

export type TaxonomyOption = { id: number; name: string | null; slug: string | null };

/**
 * A duplicate name comes back as 409 carrying the row that already exists, so
 * the caller can select it instead of showing the admin an error for what is a
 * perfectly reasonable mistake.
 */
export type TaxonomyResult =
  | { ok: true; option: TaxonomyOption; existed: boolean }
  | { ok: false; error: string };

const SIGNED_OUT = "Your session expired. Log in again.";

type Details = { existing?: TaxonomyOption } | undefined;

async function create(
  path: "/admin/brands" | "/admin/categories",
  key: "brand" | "category",
  name: string
): Promise<TaxonomyResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPost<Record<string, TaxonomyOption>>(path, { name }, token);

  if (!result.ok) {
    const existing = (result.details as Details)?.existing;
    if (result.status === 409 && existing) {
      return { ok: true, option: existing, existed: true };
    }
    return { ok: false, error: result.error };
  }

  revalidatePath("/admin/products");
  return { ok: true, option: result.data[key]!, existed: false };
}

export async function createBrandAction(name: string) {
  return create("/admin/brands", "brand", name);
}

export async function createCategoryAction(name: string) {
  return create("/admin/categories", "category", name);
}
