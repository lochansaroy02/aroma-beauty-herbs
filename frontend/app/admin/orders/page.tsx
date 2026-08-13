import { AlertCircleIcon, EyeIcon, ShoppingCartIcon } from "lucide-react";
import Link from "next/link";

import { OrderFilters } from "@/components/admin/order-filters";
import { Pagination } from "@/components/admin/pagination";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/shop/order-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchAdminOrders } from "@/lib/admin-orders";
import { formatPrice, type AdminOrderSort } from "@/lib/catalog";

const SORTS = ["newest", "oldest", "total_desc", "total_asc"];

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  const params = await props.searchParams;

  const search = single(params["search"]).trim();
  const status = single(params["status"]);
  const paymentStatus = single(params["payment_status"]);
  const sortParam = single(params["sort"]);
  const sort = (SORTS.includes(sortParam) ? sortParam : "newest") as AdminOrderSort;
  const page = Math.max(1, Number(single(params["page"])) || 1);

  const result = await fetchAdminOrders({
    page,
    search: search || undefined,
    status: status || undefined,
    payment_status: paymentStatus || undefined,
    sort,
  });

  // Query string carried onto page links, minus `page` itself.
  const baseParams = new URLSearchParams();
  if (search) baseParams.set("search", search);
  if (status) baseParams.set("status", status);
  if (paymentStatus) baseParams.set("payment_status", paymentStatus);
  if (sort !== "newest") baseParams.set("sort", sort);
  const baseQuery = baseParams.toString();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Everything that&rsquo;s been placed, newest first.
          </p>
        </div>

        {result.ok ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{result.data.pagination.total} total</Badge>
            <Badge variant="secondary">
              {formatPrice(result.data.summary.paid_revenue)} paid
            </Badge>
            {result.data.summary.awaiting_payment > 0 ? (
              <Badge variant="outline">
                {result.data.summary.awaiting_payment} awaiting payment
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      <OrderFilters
        search={search}
        status={status}
        paymentStatus={paymentStatus}
        sort={sort}
      />

      {!result.ok ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <ShoppingCartIcon className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg">
              {search || status || paymentStatus
                ? "Nothing matches those filters"
                : "No orders yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search || status || paymentStatus
                ? "Try a different search term, or clear the filters."
                : "Orders placed in the shop will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Placed</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {result.data.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Link
                          href={`/admin/orders/${order.order_number}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {order.order_number}
                        </Link>
                      </TableCell>

                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{order.customer_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.customer_email}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {order.item_count}
                        {order.line_count !== order.item_count ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({order.line_count} lines)
                          </span>
                        ) : null}
                      </TableCell>

                      <TableCell className="text-right font-medium tabular-nums">
                        {formatPrice(order.total)}
                      </TableCell>

                      <TableCell>
                        <PaymentStatusBadge status={order.payment_status} />
                      </TableCell>

                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>

                      <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                        {order.placed_at
                          ? DATE_FORMAT.format(new Date(order.placed_at))
                          : "—"}
                      </TableCell>

                      <TableCell className="text-right">
                        {/* The order number above is already a link, but it
                            reads as reference text rather than a way in. This
                            is the affordance. nativeButton={false}: the render
                            prop yields an <a>. */}
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/admin/orders/${order.order_number}`} />}
                          aria-label={`View order ${order.order_number}`}
                        >
                          <EyeIcon />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Pagination
            page={result.data.pagination.page}
            totalPages={result.data.pagination.total_pages}
            total={result.data.pagination.total}
            showing={result.data.orders.length}
            baseQuery={baseQuery}
            basePath="/admin/orders"
            noun="orders"
            perPage={result.data.pagination.limit}
          />
        </>
      )}
    </div>
  );
}
