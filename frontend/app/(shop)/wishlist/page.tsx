import { HeartIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductCard } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchWishlist } from "@/lib/cart";
import { getSessionToken } from "@/lib/session";

export const metadata = { title: "Your wishlist — Aroma Beauty Herbs" };

export default async function WishlistPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const wishlist = await fetchWishlist();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Your wishlist</h1>
        <p className="mt-1 text-muted-foreground">
          {wishlist.count === 0
            ? "Nothing saved yet."
            : `${wishlist.count} saved for later.`}
        </p>
      </div>

      {wishlist.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <HeartIcon className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg">Nothing saved yet</p>
            <p className="text-sm text-muted-foreground">
              Tap the heart on anything you want to come back to.
            </p>
            {/* nativeButton={false}: the render prop yields an <a>. */}
            <Button className="mt-2" nativeButton={false} render={<Link href="/products" />}>
              Browse the shop
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {wishlist.items.map((item) => (
            <ProductCard key={item.id} product={item.product} saved />
          ))}
        </div>
      )}
    </div>
  );
}
