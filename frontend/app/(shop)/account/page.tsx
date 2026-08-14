import {
  AlertCircleIcon,
  CheckCircle2Icon,
  PackageIcon,
  ShieldIcon,
  ShoppingBagIcon,
  TruckIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/shop/order-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fetchAccountOverview } from "@/lib/account";
import { apiGet } from "@/lib/api";
import { formatPrice } from "@/lib/catalog";
import { fetchOrders } from "@/lib/orders";
import { getSessionToken } from "@/lib/session";

export const metadata = { title: "Dashboard — Aroma Beauty Herbs" };

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

/** How many orders the dashboard shows before deferring to My Orders. */
const RECENT_LIMIT = 3;

export default async function AccountDashboardPage(props: PageProps<"/account">) {
  const { denied } = await props.searchParams;
  const token = await getSessionToken();
  // The layout already redirected a signed-out visitor; this is for the type.
  if (!token) redirect("/login");

  const [overview, orders, me] = await Promise.all([
    fetchAccountOverview(token),
    fetchOrders(token),
    apiGet<{ user: { role_as: string | null } }>("/auth/me", token),
  ]);

  const stats = overview.ok
    ? overview.data.stats
    : { total: 0, successful: 0, pending: 0, cancelled: 0 };

  const recent = orders.ok ? orders.data.orders.slice(0, RECENT_LIMIT) : [];
  const isAdmin = me.ok && me.data.user.role_as === "Admin";

  const cards = [
    { label: "Total order", value: stats.total, icon: ShoppingBagIcon },
    { label: "Successful order", value: stats.successful, icon: CheckCircle2Icon },
    { label: "Pending order", value: stats.pending, icon: TruckIcon },
  ] as const;

  return (
    <div className="grid gap-8">
      {denied === "admin" ? (
        <Alert variant="destructive" role="status">
          <AlertCircleIcon />
          <AlertDescription>That area is for admins only.</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
            Account
          </p>
          <h1 className="mt-2 font-heading text-3xl tracking-tight text-ink">
            Dashboard
          </h1>
        </div>

        {isAdmin ? (
          <Button variant="outline" nativeButton={false} render={<Link href="/admin" />}>
            <ShieldIcon />
            Go to admin
          </Button>
        ) : null}
      </div>

      {!overview.ok ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{overview.error}</AlertDescription>
        </Alert>
      ) : null}

      {/*
        Square-ish tiles: the number is the content, so it gets the weight and
        the label sits under it rather than competing beside it.
      */}
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-ink/10 bg-paper p-5"
          >
            <card.icon className="size-5 text-clay" aria-hidden />
            <p className="mt-6 font-heading text-4xl leading-none text-ink tabular-nums">
              {card.value}
            </p>
            <p className="mt-2 text-sm text-ink-soft">{card.label}</p>
          </div>
        ))}
      </div>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl tracking-tight text-ink">
            Recent orders
          </h2>

          {stats.total > 0 ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/account/orders" />}
            >
              View all
            </Button>
          ) : null}
        </div>

        {!orders.ok ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{orders.error}</AlertDescription>
          </Alert>
        ) : recent.length === 0 ? (
          <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-ink/15 bg-paper px-6 py-16 text-center">
            <PackageIcon className="size-8 text-clay" aria-hidden />
            <p className="font-heading text-lg text-ink">No orders yet</p>
            <p className="max-w-sm text-sm text-ink-soft">
              When you place an order it will appear here, with its status and a
              link to the invoice.
            </p>
            <Button
              className="mt-2"
              nativeButton={false}
              render={<Link href="/products" />}
            >
              Browse the shop
            </Button>
          </div>
        ) : (
          <ul className="grid gap-3">
            {recent.map((order) => (
              <li
                key={order.id}
                className="rounded-2xl border border-ink/10 bg-paper p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-mono text-sm text-ink">
                        {order.order_number}
                      </p>
                      <OrderStatusBadge status={order.status} />
                      <PaymentStatusBadge status={order.payment_status} />
                    </div>

                    <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
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
      </section>
    </div>
  );
}
