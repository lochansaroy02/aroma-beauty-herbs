import {
  AlertCircleIcon,
  BoxesIcon,
  IndianRupeeIcon,
  PackageIcon,
  ShoppingCartIcon,
} from "lucide-react";
import Link from "next/link";

import { OrderTrendChart } from "@/components/admin/order-trend-chart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { fetchAdminOrders } from "@/lib/admin-orders";
import { fetchOrderStats } from "@/lib/admin-stats";
import { formatPrice, isStatGrain, type StatGrain } from "@/lib/catalog";
import { fetchInventory } from "@/lib/inventory";
import { fetchProducts } from "@/lib/products";

export default async function AdminDashboardPage(props: PageProps<"/admin">) {
  const params = await props.searchParams;
  const rangeParam = Array.isArray(params["range"]) ? params["range"][0] : params["range"];
  const grain: StatGrain = rangeParam && isStatGrain(rangeParam) ? rangeParam : "day";

  // Only the counts are needed, so ask for the smallest page possible.
  const [products, orders, inventory, stats] = await Promise.all([
    fetchProducts({ limit: 1 }),
    fetchAdminOrders({ page: 1 }),
    fetchInventory({ page: 1 }),
    fetchOrderStats(grain),
  ]);

  const productCount = products.ok ? products.data.pagination.total : null;
  const orderCount = orders.ok ? orders.data.pagination.total : null;
  const awaiting = orders.ok ? orders.data.summary.awaiting_payment : 0;
  const revenue = orders.ok ? orders.data.summary.paid_revenue : null;
  const stock = inventory.ok ? inventory.data.summary : null;

  const tiles = [
    {
      href: "/admin/products",
      icon: PackageIcon,
      label: "Products",
      value: productCount === null ? "—" : String(productCount),
      description:
        productCount === null
          ? "Couldn't reach the catalogue API."
          : "Live in the catalogue",
    },
    {
      href: "/admin/orders",
      icon: ShoppingCartIcon,
      label: "Orders",
      value: orderCount === null ? "—" : String(orderCount),
      description:
        orderCount === null
          ? "Couldn't reach the orders API."
          : awaiting > 0
            ? `${awaiting} awaiting payment`
            : "All settled",
    },
    {
      href: "/admin/orders?payment_status=paid",
      icon: IndianRupeeIcon,
      label: "Paid revenue",
      value: revenue === null ? "—" : formatPrice(revenue),
      description: "Across all paid orders",
    },
    {
      // Deep-links to the filter that matters when something needs reordering.
      href: stock && stock.low_stock > 0 ? "/admin/inventory?filter=low" : "/admin/inventory",
      icon: BoxesIcon,
      label: "Inventory",
      value: stock === null ? "—" : String(stock.total_units),
      description:
        stock === null
          ? "Couldn't reach the inventory API."
          : stock.low_stock > 0 || stock.out_of_stock > 0
            ? [
                stock.low_stock > 0 ? `${stock.low_stock} low` : null,
                stock.out_of_stock > 0 ? `${stock.out_of_stock} out of stock` : null,
              ]
                .filter(Boolean)
                .join(", ")
            : "Units across all variants",
    },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          An overview of the store.
        </p>
      </div>

      {/*
        Square stat tiles: aspect-square with a fixed max width, so they stay
        compact instead of stretching to fill the row. Four across on desktop
        keeps them beside each other rather than wrapping under the chart.
      */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            aria-label={`${tile.label}: ${tile.value}. ${tile.description}`}
            className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* Centred cluster rather than pinned top-and-bottom: a square forces
                more height than this much content needs, and justify-between
                would leave a void through the middle of every tile. */}
            <Card className="flex aspect-square flex-col justify-center gap-1 p-4 transition-colors hover:bg-accent/50">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <tile.icon className="size-3.5 shrink-0" />
                <span className="truncate text-xs">{tile.label}</span>
              </div>

              {/* Proportional figures — a standalone value, not a column. */}
              <p className="truncate font-heading text-2xl leading-tight">{tile.value}</p>
              <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {tile.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {stats.ok ? (
        <OrderTrendChart stats={stats.data} />
      ) : (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{stats.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}