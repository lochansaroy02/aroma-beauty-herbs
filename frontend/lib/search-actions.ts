"use server";

import { fetchProducts } from "./products";
import { MIN_QUERY_LENGTH, type ProductListItem } from "./catalog";

/** Enough to fill the panel without it becoming a second catalogue page. */
const RESULT_LIMIT = 6;

export type SearchResult =
  | { ok: true; products: ProductListItem[]; total: number }
  | { ok: false; error: string };

/**
 * The catalogue endpoint is public, but `apiGet` is server-only — this is the
 * seam that lets the client-side dialog reach it without the browser learning
 * the API's origin.
 */
export async function searchProductsAction(term: string): Promise<SearchResult> {
  const search = term.trim();

  if (search.length < MIN_QUERY_LENGTH) {
    return { ok: true, products: [], total: 0 };
  }

  const result = await fetchProducts({ search, limit: RESULT_LIMIT });

  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    products: result.data.products,
    total: result.data.pagination.total,
  };
}
