import { AlertCircleIcon, ImageIcon, TriangleAlertIcon } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/shop/checkout-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiGet } from "@/lib/api";
import { fetchCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";
import { getSessionToken } from "@/lib/session";

export const metadata = { title: "Checkout — Aroma Beauty Herbs" };

type MeResponse = {
  user: { name: string | null; email: string; phone: string | null };
};

type CheckoutConfig = {
  razorpay_configured: boolean;
  shipping: { flat_rate: number; free_over: number };
};

export default async function CheckoutPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  // Shipping rules come from the API so this summary can't drift from the
  // amount actually charged.
  const [cart, me, config] = await Promise.all([
    fetchCart(),
    apiGet<MeResponse>("/auth/me", token),
    apiGet<CheckoutConfig>("/checkout/config", token),
  ]);

  // Nothing to pay for — don't strand them on an empty form.
  if (cart.items.length === 0) redirect("/cart");

  const rules = config.ok ? config.data.shipping : { flat_rate: 49, free_over: 499 };
  const shipping =
    cart.summary.subtotal >= rules.free_over ? 0 : rules.flat_rate;
  const total = cart.summary.subtotal + shipping;
  const paymentsLive = config.ok && config.data.razorpay_configured;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 font-heading text-3xl tracking-tight">Checkout</h1>

      {cart.summary.has_unavailable ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon />
          <AlertDescription>
            Some items in your cart are no longer available in the quantity you chose.
            Fix them in your cart before paying.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <CheckoutForm
          defaults={{
            name: me.ok ? me.data.user.name : null,
            email: me.ok ? me.data.user.email : "",
            phone: me.ok ? me.data.user.phone : null,
          }}
        />

        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Order summary</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4">
            <ul className="grid gap-3">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded border bg-muted">
                    {item.product.image ? (
                      <Image
                        src={item.product.image.url}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="size-4" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.product.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Qty {item.quantity}
                    </p>
                  </div>

                  <span className="text-sm tabular-nums">
                    {formatPrice(item.line_total)}
                  </span>
                </li>
              ))}
            </ul>

            <Separator />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatPrice(cart.summary.subtotal)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery</span>
              <span className="tabular-nums">
                {shipping === 0 ? "Free" : formatPrice(shipping)}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(total)}</span>
            </div>

            <p className="text-xs text-muted-foreground">
              Prices include GST. The API re-checks every price and stock level before
              charging, so this is a preview.
            </p>

            {/* Honest about the state of the integration rather than failing
                at the payment window. */}
            {!paymentsLive ? (
              <Alert>
                <TriangleAlertIcon />
                <AlertDescription className="text-xs">
                  Card payments go live once the business is verified with Razorpay.
                  Until then your order is recorded as awaiting payment.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
