import { AlertCircleIcon, PackageIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/shop/order-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/catalog";
import { fetchOrders } from "@/lib/orders";
import { getSessionToken } from "@/lib/session";

export const metadata = { title: "Your orders — Aroma Beauty Herbs" };

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

export default async function OrdersPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const result = await fetchOrders(token);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 font-heading text-3xl tracking-tight">Your orders</h1>

      {!result.ok ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <PackageIcon className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg">No orders yet</p>
            {/* nativeButton={false}: the render prop yields an <a>. */}
            <Button className="mt-2" nativeButton={false} render={<Link href="/products" />}>
              Browse the shop
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {result.data.orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="grid gap-1">
                  <Link
                    href={`/orders/${order.order_number}`}
                    className="font-mono text-sm hover:underline"
                  >
                    {order.order_number}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {order.placed_at
                      ? DATE_FORMAT.format(new Date(order.placed_at))
                      : "—"}{" "}
                    · {order.items.length}{" "}
                    {order.items.length === 1 ? "item" : "items"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.payment_status} />
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-medium tabular-nums">
                    {formatPrice(order.totals.total)}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/orders/${order.order_number}`} />}
                    className="h-auto p-0"
                  >
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
