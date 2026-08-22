import { LeafIcon } from "lucide-react";

import { ProductCard } from "@/components/shop/product-card";
import { Card, CardContent } from "@/components/ui/card";
import { fetchShopProducts } from "@/lib/shop-api";

export const metadata = {
  title: "Shop — Aroma Beauty Herbs",
  description: "Herbal skincare, blended in small batches.",
};

/**
 * The range.
 *
 * Four kits, read from the Barber Syndicate catalogue. There is no search, sort
 * or pagination here on purpose — those exist to make a large catalogue
 * navigable, and with four products they would be furniture that does nothing.
 */
export default async function ShopPage() {
  const products = await fetchShopProducts();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-10">
        <h1 className="font-heading text-3xl tracking-tight">Shop</h1>
        <p className="mt-1 text-muted-foreground">
          Skincare blended in small batches, from plants we can name.
        </p>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <LeafIcon className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg">The range is unavailable</p>
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t reach the catalogue just now. Please try again shortly.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
