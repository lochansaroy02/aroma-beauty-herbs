"use server";

import { updateTag } from "next/cache";

import { CATALOGUE_TAG } from "./shop-api";

/**
 * Drops the cached catalogue so the next render re-reads it.
 *
 * The products on this site belong to barbersyndicate.in, and nothing over
 * there can tell us when they change. Without this, an edit takes up to five
 * minutes to appear — and on a quiet site longer still, because the cache is
 * stale-while-revalidate: the first request after expiry is served the old copy
 * and merely starts the refetch. Renaming a product also changes its slug, and
 * a stale page still links to the old one, which the storefront answers with a
 * 500 rather than a redirect.
 *
 * `updateTag` rather than `revalidateTag`: this runs in a Server Action whose
 * whole point is that the admin sees the result immediately. `revalidateTag`
 * would expire the entry but still let this very render serve the stale copy,
 * so the page would report success while showing the old names.
 */
export async function refreshCatalogueAction() {
  updateTag(CATALOGUE_TAG);
}
