import { CheckCircle2Icon, ClockIcon, ImageIcon, XCircleIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/shop/order-status-badge";
import { RetryPaymentButton } from "@/components/shop/retry-payment-button";
import { SimulatePaymentButton } from "@/components/shop/simulate-payment-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiGet } from "@/lib/api";
import { formatPrice } from "@/lib/catalog";
import { fetchOrder } from "@/lib/orders";
import { getSessionToken } from "@/lib/session";

export const metadata = { title: "Order — Aroma Beauty Herbs" };

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function formatDate(value: string | null): string {
  return value ? DATE_FORMAT.format(new Date(value)) : "—";
}

export default async function OrderPage(props: PageProps<"/orders/[orderNumber]">) {
  const { orderNumber } = await props.params;

  const token = await getSessionToken();
  if (!token) redirect("/login");

  const [result, config] = await Promise.all([
    fetchOrder(orderNumber, token),
    apiGet<{ test_payments_enabled: boolean }>("/checkout/config", token),
  ]);

  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(result.error);
  }

  const { order } = result.data;
  const paid = order.payment_status === "paid";
  const cancelled = order.status === "cancelled";
  // Only offered while Razorpay isn't live; the API refuses it otherwise.
  const testPayments = config.ok && config.data.test_payments_enabled;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          {paid ? (
            <CheckCircle2Icon className="size-10 text-primary" />
          ) : cancelled ? (
            <XCircleIcon className="size-10 text-destructive" />
          ) : (
            <ClockIcon className="size-10 text-muted-foreground" />
          )}

          <h1 className="font-heading text-2xl tracking-tight">
            {paid
              ? "Thank you — your order is confirmed"
              : cancelled
                ? "This order was cancelled"
                : "Order placed, awaiting payment"}
          </h1>

          <p className="font-mono text-sm text-muted-foreground">
            {order.order_number}
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
          </div>
        </CardContent>
      </Card>

      {!paid && !cancelled ? (
        <Alert className="mb-6">
          <ClockIcon />
          <AlertDescription>
            {order.razorpay_order_id
              ? "We haven't received your payment yet. You can try again below."
              : "Card payments aren't live yet — the business is still being verified with Razorpay. Your order is recorded and nothing has been charged."}
          </AlertDescription>
        </Alert>
      ) : null}

      {order.payment_error && !paid ? (
        <Alert variant="destructive" className="mb-6">
          <XCircleIcon />
          <AlertDescription>{order.payment_error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Items</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4">
          <ul className="grid gap-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3">
                <Link
                  href={`/products/${item.slug}`}
                  className="relative size-14 shrink-0 overflow-hidden rounded border bg-muted"
                >
                  {item.image ? (
                    <Image
                      src={item.image.url}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-4" />
                    </span>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${item.slug}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {item.product_name}
                  </Link>
                  {item.variant_details ? (
                    <p className="text-xs text-muted-foreground">
                      {item.variant_details}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatPrice(item.unit_price)} × {item.quantity}
                  </p>
                </div>

                <span className="text-sm tabular-nums">
                  {formatPrice(item.total_price)}
                </span>
              </li>
            ))}
          </ul>

          <Separator />

          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatPrice(order.totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <span className="tabular-nums">
                {order.totals.shipping === 0
                  ? "Free"
                  : formatPrice(order.totals.shipping)}
              </span>
            </div>
            {order.totals.discount > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular-nums">
                  −{formatPrice(order.totals.discount)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Includes GST</span>
              <span className="tabular-nums">{formatPrice(order.totals.tax_total)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(order.totals.total)}</span>
          </div>

          {!paid && !cancelled && order.razorpay_order_id ? (
            <RetryPaymentButton
              orderNumber={order.order_number}
              customer={{
                name: `${order.billing.first_name} ${order.billing.last_name}`.trim(),
                email: order.billing.email,
                phone: order.billing.phone,
              }}
            />
          ) : null}

          {!paid && !cancelled && testPayments ? (
            <SimulatePaymentButton orderNumber={order.order_number} />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Delivering to</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="text-foreground">
              {order.billing.first_name} {order.billing.last_name}
            </p>
            <p>{order.billing.address}</p>
            <p>
              {order.billing.city}, {order.billing.state} {order.billing.zip}
            </p>
            <p>{order.billing.country}</p>
            <p className="mt-2">{order.billing.phone}</p>
            <p>{order.billing.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 text-sm">
              {order.history.map((entry, index) => (
                <li key={`${entry.status}-${index}`} className="grid gap-0.5">
                  <span className="font-medium capitalize">{entry.status}</span>
                  {entry.remarks ? (
                    <span className="text-muted-foreground">{entry.remarks}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {formatDate(entry.at)}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {/* nativeButton={false}: the render prop yields an <a>. */}
        <Button variant="outline" nativeButton={false} render={<Link href="/orders" />}>
          All orders
        </Button>
        <Button nativeButton={false} render={<Link href="/products" />}>
          Keep shopping
        </Button>
      </div>
    </div>
  );
}
