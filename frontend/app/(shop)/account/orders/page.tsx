import { AlertCircleIcon, PackageIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/shop/order-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/catalog";
import { fetchOrders } from "@/lib/orders";
import { getSessionToken } from "@/lib/session";

export const metadata = { title: "My orders — Aroma Beauty Herbs" };

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

export default async function AccountOrdersPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const result = await fetchOrders(token);

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
          Account
        </p>
        <h1 className="mt-2 font-heading text-3xl tracking-tight text-ink">
          My orders
        </h1>
      </div>

      {!result.ok ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.orders.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-ink/15 bg-paper px-6 py-16 text-center">
          <PackageIcon className="size-8 text-clay" aria-hidden />
          <p className="font-heading text-lg text-ink">No orders yet</p>
          <Button className="mt-2" nativeButton={false} render={<Link href="/products" />}>
            Browse the shop
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {result.data.orders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-ink/10 bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-mono text-sm text-ink">{order.order_number}</p>
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.payment_status} />
                  </div>

                  <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-clay">Date placed</dt>
                      <dd className="mt-0.5 text-ink-soft">
                        {order.placed_at
                          ? DATE_FORMAT.format(new Date(order.placed_at))
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-clay">Amount</dt>
                      <dd className="mt-0.5 text-ink">
                        {formatPrice(order.totals.total)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-clay">Items</dt>
                      <dd className="mt-0.5 text-ink-soft">
                        {order.items.length}{" "}
                        {order.items.length === 1 ? "item" : "items"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-clay">Ship to</dt>
                      <dd className="mt-0.5 truncate text-ink-soft">
                        {order.billing.first_name} {order.billing.last_name} ·{" "}
                        {order.billing.city}
                      </dd>
                    </div>
                  </dl>
                </div>

                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/orders/${order.order_number}`} />}
                >
                  View details
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
