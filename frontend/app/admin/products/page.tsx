import { AlertCircleIcon, ImageIcon, PackageIcon, StarIcon } from "lucide-react";
import Image from "next/image";

import { AddProductDialog } from "@/components/admin/add-product-dialog";
import { Pagination } from "@/components/admin/pagination";
import { ProductFilters } from "@/components/admin/product-filters";
import { ProductRowActions } from "@/components/admin/product-row-actions";
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
import {
  PRODUCT_SORTS,
  formatPrice,
  type AdminProduct,
  type ProductSort,
} from "@/lib/catalog";
import { fetchAdminProducts } from "@/lib/admin-products";
import { fetchTaxonomies } from "@/lib/taxonomy";

const SORT_VALUES = PRODUCT_SORTS.map((option) => option.value);

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function Thumbnail({ product }: { product: AdminProduct }) {
  // Falls back to the first gallery shot, same as the storefront does.
  const image = product.main_image ?? product.gallery[0] ?? null;

  if (!image) {
    return (
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"
        aria-hidden
      >
        <ImageIcon className="size-4" />
      </div>
    );
  }

  return (
    <Image
      src={image.url}
      alt={image.alt ?? product.product_name}
      width={40}
      height={40}
      className="size-10 shrink-0 rounded-md border object-cover"
    />
  );
}

export default async function AdminProductsPage(props: PageProps<"/admin/products">) {
  const params = await props.searchParams;

  const search = single(params["search"]).trim();
  const featured = single(params["featured"]);
  const sortParam = single(params["sort"]);
  const sort = (SORT_VALUES as string[]).includes(sortParam)
    ? (sortParam as ProductSort)
    : "newest";
  const page = Math.max(1, Number(single(params["page"])) || 1);

  const status = single(params["status"]);

  // The admin listing, not the public one — a draft must stay reachable or it
  // becomes uneditable the moment someone deactivates it.
  const [result, taxonomies] = await Promise.all([
    fetchAdminProducts({
      page,
      search: search || undefined,
      featured: featured === "true" || featured === "false" ? featured : undefined,
      sort,
      status: status || undefined,
    }),
    fetchTaxonomies(),
  ]);

  // Query string carried onto page links, minus `page` itself.
  const baseParams = new URLSearchParams();
  if (search) baseParams.set("search", search);
  if (featured) baseParams.set("featured", featured);
  if (status) baseParams.set("status", status);
  if (sort !== "newest") baseParams.set("sort", sort);
  const baseQuery = baseParams.toString();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Your catalogue, as customers see it.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {result.ok ? (
            <>
              <Badge variant="secondary">{result.data.pagination.total} total</Badge>
              {result.data.summary.inactive > 0 ? (
                <Badge variant="outline">{result.data.summary.inactive} draft</Badge>
              ) : null}
            </>
          ) : null}
          <AddProductDialog
            categories={taxonomies.categories}
            brands={taxonomies.brands}
          />
        </div>
      </div>

      <ProductFilters
        search={search}
        sort={sort}
        featured={featured}
        sorts={PRODUCT_SORTS}
      />

      {!result.ok ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <PackageIcon className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg">
              {search || featured ? "Nothing matches those filters" : "No products yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search || featured
                ? "Try a different search term, or clear the filters."
                : "Products added to the catalogue will appear here."}
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
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Brand</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="hidden sm:table-cell">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Thumbnail product={product} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">
                              {product.product_name}
                            </span>
                            {product.is_featured ? (
                              <StarIcon
                                className="size-3.5 shrink-0 fill-primary text-primary"
                                aria-label="Featured"
                              />
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {product.product_code}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {product.category?.name ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {product.brand?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {product.variant?.sale_price != null ? (
                        <span className="whitespace-nowrap">
                          <span className="font-medium tabular-nums">
                            {formatPrice(product.variant.sale_price)}
                          </span>
                          {product.variant.mrp != null &&
                          product.variant.mrp > product.variant.sale_price ? (
                            <span className="ml-1.5 text-xs text-muted-foreground line-through tabular-nums">
                              {formatPrice(product.variant.mrp)}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant={
                          (product.variant?.available_qty ?? 0) > 0
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {(product.variant?.available_qty ?? 0) > 0
                          ? `${product.variant?.available_qty} in stock`
                          : "Out"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={product.status === 1 ? "secondary" : "outline"}>
                        {product.status === 1 ? "Active" : "Draft"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <ProductRowActions
                        productId={product.id}
                        productName={product.product_name}
                        brands={taxonomies.brands}
                        categories={taxonomies.categories}
                      />
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
            showing={result.data.products.length}
            baseQuery={baseQuery}
          />
        </>
      )}
    </div>
  );
}
