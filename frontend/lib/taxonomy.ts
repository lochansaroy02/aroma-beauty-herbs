import "server-only";

import { apiGet } from "./api";

export type TaxonomyOption = { id: number; name: string | null; slug: string | null };

/**
 * Categories and brands for the create-product pickers. Both are public
 * endpoints, so no token is needed.
 */
export async function fetchTaxonomies(): Promise<{
  categories: TaxonomyOption[];
  brands: TaxonomyOption[];
}> {
  const [categories, brands] = await Promise.all([
    apiGet<{ categories: TaxonomyOption[] }>("/categories"),
    apiGet<{ brands: TaxonomyOption[] }>("/brands"),
  ]);

  return {
    categories: categories.ok ? categories.data.categories : [],
    brands: brands.ok ? brands.data.brands : [],
  };
}
