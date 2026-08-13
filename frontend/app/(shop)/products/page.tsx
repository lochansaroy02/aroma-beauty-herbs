import { AlertCircleIcon, PackageIcon } from "lucide-react";

import { ProductCard } from "@/components/shop/product-card";
import { ShopFilters } from "@/components/shop/shop-filters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { fetchWishlist } from "@/lib/cart";
import { PRODUCT_SORTS, type ProductSort } from "@/lib/catalog";
import { fetchProducts } from "@/lib/products";

const SORT_VALUES = PRODUCT_SORTS.map((option) => option.value);

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export const metadata = {
  title: "Shop — Aroma Beauty Herbs",
  description: "Herbal skincare, blended in small batches.",
};

export default async function ShopPage(props: PageProps<"/products">) {
  const params = await props.searchParams;

  const search = single(params["search"]).trim();
  const sortParam = single(params["sort"]);
  const sort = (SORT_VALUES as string[]).includes(sortParam)
    ? (sortParam as ProductSort)
    : "newest";
  const page = Math.max(1, Number(single(params["page"])) || 1);

  const [result, wishlist] = await Promise.all([
    fetchProducts({ page, limit: 24, search: search || undefined, sort }),
    fetchWishlist(),
  ]);

  const saved = new Set(wishlist.product_ids);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Shop</h1>
        <p className="mt-1 text-muted-foreground">
          Skincare blended in small batches, from plants we can name.
        </p>
      </div>

      <div className="mb-8">
        <ShopFilters search={search} sort={sort} sorts={PRODUCT_SORTS} />
      </div>

      {!result.ok ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <PackageIcon className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg">
              {search ? "Nothing matches that search" : "Nothing here yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search
                ? "Try a different term."
                : "New blends are on their way — check back soon."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {result.data.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              saved={saved.has(product.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
