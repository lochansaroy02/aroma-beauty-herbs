import { AlertCircleIcon, AlertTriangleIcon, BoxesIcon } from "lucide-react";
import Link from "next/link";

import { AdjustStockDialog } from "@/components/admin/adjust-stock-dialog";
import { InventoryFilters } from "@/components/admin/inventory-filters";
import { Pagination } from "@/components/admin/pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INVENTORY_FILTERS, INVENTORY_SORTS, type StockState } from "@/lib/catalog";
import { fetchInventory } from "@/lib/inventory";

const FILTER_VALUES = INVENTORY_FILTERS.map((option) => option.value) as string[];
const SORT_VALUES = INVENTORY_SORTS.map((option) => option.value) as string[];

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const STATE_LABEL: Record<StockState, string> = {
  out: "Out of stock",
  low: "Low",
  ok: "In stock",
};

const STATE_VARIANT: Record<StockState, "default" | "secondary" | "destructive"> = {
  out: "destructive",
  low: "secondary",
  ok: "default",
};

export default async function AdminInventoryPage(props: PageProps<"/admin/inventory">) {
  const params = await props.searchParams;

  const search = single(params["search"]).trim();
  const filterParam = single(params["filter"]);
  const filter = FILTER_VALUES.includes(filterParam) ? filterParam : "all";
  const sortParam = single(params["sort"]);
  const sort = SORT_VALUES.includes(sortParam) ? sortParam : "stock_asc";
  const page = Math.max(1, Number(single(params["page"])) || 1);

  const result = await fetchInventory({
    page,
    search: search || undefined,
    filter,
    sort,
  });

  // Query string carried onto page links, minus `page` itself.
  const baseParams = new URLSearchParams();
  if (search) baseParams.set("search", search);
  if (filter !== "all") baseParams.set("filter", filter);
  if (sort !== "stock_asc") baseParams.set("sort", sort);
  const baseQuery = baseParams.toString();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Stock per variant, and the movements behind it.
          </p>
        </div>

        {result.ok ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {result.data.summary.total_units} units
            </Badge>
            {result.data.summary.low_stock > 0 ? (
              <Badge variant="outline">
                {result.data.summary.low_stock} low
              </Badge>
            ) : null}
            {result.data.summary.out_of_stock > 0 ? (
              <Badge variant="destructive">
                {result.data.summary.out_of_stock} out
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Worth a banner, not just a badge — this is what gets reordered. */}
      {result.ok && result.data.summary.low_stock > 0 && filter !== "low" ? (
        <Alert className="mb-6">
          <AlertTriangleIcon />
          <AlertDescription>
            {result.data.summary.low_stock} variant
            {result.data.summary.low_stock === 1 ? " has" : "s have"} hit their low
            stock alert.{" "}
            <Link href="/admin/inventory?filter=low" className="underline">
              Show them
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <InventoryFilters search={search} filter={filter} sort={sort} />

      {!result.ok ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <BoxesIcon className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg">
              {search || filter !== "all"
                ? "Nothing matches those filters"
                : "Nothing to track yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search || filter !== "all"
                ? "Try a different search term, or clear the filters."
                : "Add a product and its stock will show up here."}
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
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">In stock</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Reserved
                    </TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      Alert at
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Manage</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {result.data.items.map((item) => (
                    <TableRow key={item.variant_id}>
                      <TableCell>
                        <div className="min-w-0">
                          <Link
                            href={`/products/${item.product.slug}`}
                            className="truncate font-medium hover:underline"
                          >
                            {item.product.product_name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.variation_name && item.variation_name !== "Default"
                              ? `${item.variation_name} · `
                              : ""}
                            {item.sku}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {item.stock_qty}
                      </TableCell>

                      <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                        {item.reserved_qty}
                      </TableCell>

                      <TableCell className="text-right font-medium tabular-nums">
                        {item.available_qty}
                      </TableCell>

                      <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                        {item.low_stock_alert > 0 ? item.low_stock_alert : "—"}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={STATE_VARIANT[item.state]}>
                            {STATE_LABEL[item.state]}
                          </Badge>
                          {item.oversold ? (
                            <Badge variant="destructive" title="Reserved exceeds stock">
                              Oversold
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <AdjustStockDialog item={item} />
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
            showing={result.data.items.length}
            baseQuery={baseQuery}
            basePath="/admin/inventory"
            noun="variants"
            perPage={result.data.pagination.limit}
          />
        </>
      )}
    </div>
  );
}
