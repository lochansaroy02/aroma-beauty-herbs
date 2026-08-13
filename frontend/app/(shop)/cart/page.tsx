import { AlertCircleIcon, ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CartLine } from "@/components/shop/cart-line";
import { ClearCartButton } from "@/components/shop/clear-cart-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";
import { getSessionToken } from "@/lib/session";

export const metadata = { title: "Your cart — Aroma Beauty Herbs" };

export default async function CartPage() {
  // A cart belongs to an account, so there's nothing to show signed out.
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const cart = await fetchCart();

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <Card className="bg-paper-deep">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingBagIcon className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg">Your cart is empty</p>
            <p className="text-sm text-muted-foreground">
              Nothing added yet — the range is a good place to start.
            </p>
            {/* nativeButton={false}: the render prop yields an <a>. */}
            <Button className="mt-2" nativeButton={false} render={<Link href="/products" />}>
              Browse the shop
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl tracking-tight">Your cart</h1>
        <ClearCartButton />
      </div>

      {cart.summary.has_unavailable ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon />
          <AlertDescription>
            Some items are no longer available in the quantity you chose. Adjust them
            before checking out.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Card className="py-0">
          <CardContent className="divide-y px-5 py-0">
            {cart.items.map((item) => (
              <CartLine key={item.id} item={item} />
            ))}
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardContent className="grid gap-4">
              <h2 className="font-heading text-lg">Summary</h2>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Items ({cart.summary.total_quantity})
                </span>
                <span className="tabular-nums">{formatPrice(cart.summary.subtotal)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span className="text-muted-foreground">Calculated at checkout</span>
              </div>

              <Separator />

              <div className="flex justify-between font-medium">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPrice(cart.summary.subtotal)}</span>
              </div>

              {/* nativeButton={false}: the render prop yields an <a>. */}
              <Button
                className="w-full"
                disabled={cart.summary.has_unavailable}
                nativeButton={false}
                render={<Link href="/checkout" />}
              >
                Checkout
              </Button>
              {cart.summary.has_unavailable ? (
                <p className="text-center text-xs text-muted-foreground">
                  Fix the unavailable items above to continue.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
