import "server-only";

import { apiGet } from "./api";
import { buildProductQuery, type ProductDetail, type ProductListResponse, type ProductQuery } from "./catalog";

export function fetchProducts(query: ProductQuery) {
  return apiGet<ProductListResponse>(`/products${buildProductQuery(query)}`);
}

export function fetchProduct(slug: string) {
  return apiGet<{ product: ProductDetail }>(`/products/${encodeURIComponent(slug)}`);
}
