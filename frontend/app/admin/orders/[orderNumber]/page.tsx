import { ArrowLeftIcon, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusControl } from "@/components/admin/order-status-control";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/shop/order-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchAdminOrder } from "@/lib/admin-orders";
import { formatPrice } from "@/lib/catalog";

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function formatDate(value: string | null): string {
  return value ? DATE_FORMAT.format(new Date(value)) : "—";
}

export default async function AdminOrderPage(
  props: PageProps<"/admin/orders/[orderNumber]">
) {
  const { orderNumber } = await props.params;
  const result = await fetchAdminOrder(orderNumber);

  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(result.error);
  }

  const { order } = result.data;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div>
      <div className="mb-6">
        {/* nativeButton={false}: the render prop yields an <a>. */}
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/admin/orders" />}
          className="-ml-2 mb-3 text-muted-foreground"
        >
          <ArrowLeftIcon />
          All orders
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-xl tracking-tight">{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">
              Placed {formatDate(order.placed_at)} · {itemCount}{" "}
              {itemCount === 1 ? "item" : "items"} · {formatPrice(order.totals.total)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
          </div>
        </div>
      </div>

      {order.payment_error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{order.payment_error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Items</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-4">
              <ul className="grid gap-4">
                {order.items.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded border bg-muted">
                      {item.image ? (
                        <Image
                          src={item.image.url}
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
                        {item.tax_rate > 0 ? ` · GST ${item.tax_rate}%` : ""}
                      </p>
                    </div>

                    <span className="text-sm tabular-nums">
                      {formatPrice(item.total_price)}
                    </span>
                  </li>
                ))}
              </ul>

              <Separator />

              <div className="grid gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">
                    {formatPrice(order.totals.subtotal)}
                  </span>
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
                  <span>of which GST</span>
                  <span className="tabular-nums">
                    {formatPrice(order.totals.tax_total)}
                  </span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span className="tabular-nums">{formatPrice(order.totals.total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">History</CardTitle>
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

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Update status</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusControl
                orderNumber={order.order_number}
                status={order.status}
                paid={order.payment_status === "paid"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm text-muted-foreground">
              <p className="text-foreground">
                {order.billing.first_name} {order.billing.last_name}
              </p>
              <p>{order.billing.email}</p>
              <p>{order.billing.phone}</p>
              {order.customer && order.customer.email !== order.billing.email ? (
                <p className="mt-2 text-xs">Account: {order.customer.email}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Delivering to</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-0.5 text-sm text-muted-foreground">
              <p>{order.billing.address}</p>
              <p>
                {order.billing.city}, {order.billing.state} {order.billing.zip}
              </p>
              <p>{order.billing.country}</p>
              {order.notes ? (
                <p className="mt-2 text-foreground">Note: {order.notes}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Payment</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm text-muted-foreground">
              <p className="capitalize">Method: {order.payment_method}</p>
              {order.razorpay_order_id ? (
                <p className="break-all font-mono text-xs">
                  Order: {order.razorpay_order_id}
                </p>
              ) : null}
              {order.razorpay_payment_id ? (
                <p className="break-all font-mono text-xs">
                  Payment: {order.razorpay_payment_id}
                </p>
              ) : null}
              {!order.razorpay_order_id && !order.razorpay_payment_id ? (
                <p>No payment reference — Razorpay isn&rsquo;t live yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
