import { AlertCircleIcon, FilmIcon, PackageIcon } from "lucide-react";
import Link from "next/link";

import { AddVideoDialog } from "@/components/admin/add-video-dialog";
import { Pagination } from "@/components/admin/pagination";
import { VideoRowActions } from "@/components/admin/video-row-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchProducts } from "@/lib/products";
import { fetchVideos } from "@/lib/videos";

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function duration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export default async function AdminVideosPage(props: PageProps<"/admin/videos">) {
  const params = await props.searchParams;

  const status = single(params["status"]);
  const page = Math.max(1, Number(single(params["page"])) || 1);

  // The picker needs every product, not just the first page.
  const [result, products] = await Promise.all([
    fetchVideos({ page, status: status || undefined }),
    fetchProducts({ limit: 60, sort: "name_asc" }),
  ]);

  const productOptions = products.ok
    ? products.data.products.map((product) => ({
        id: product.id,
        name: product.product_name,
      }))
    : [];

  const baseParams = new URLSearchParams();
  if (status) baseParams.set("status", status);
  const baseQuery = baseParams.toString();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">Videos</h1>
          <p className="text-sm text-muted-foreground">
            Product videos, ready for wherever they end up on the storefront.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {result.ok ? (
            <Badge variant="secondary">{result.data.pagination.total} total</Badge>
          ) : null}
          <AddVideoDialog products={productOptions} />
        </div>
      </div>

      {!result.ok ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.videos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <FilmIcon className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg">No videos yet</p>
            <p className="text-sm text-muted-foreground">
              Upload one and it&rsquo;ll be served by the API as soon as it&rsquo;s
              active.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {result.data.videos.map((item) => (
              <Card key={item.id}>
                <CardContent className="grid gap-3">
                  {item.video ? (
                    <video
                      src={item.video.url}
                      controls
                      preload="metadata"
                      className="aspect-video w-full rounded bg-black"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded border border-dashed bg-muted text-muted-foreground">
                      <FilmIcon className="size-6" />
                    </div>
                  )}

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title ?? "Untitled"}</p>

                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {item.product ? (
                          <Link
                            href={`/products/${item.product.slug}`}
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <PackageIcon className="size-3" />
                            {item.product.product_name}
                          </Link>
                        ) : (
                          <span>No product</span>
                        )}

                        {item.video && duration(item.video.duration) ? (
                          <span>· {duration(item.video.duration)}</span>
                        ) : null}

                        <span>
                          ·{" "}
                          {item.created_at
                            ? DATE_FORMAT.format(new Date(item.created_at))
                            : "—"}
                        </span>
                      </p>
                    </div>

                    <Badge variant={item.is_active ? "default" : "secondary"}>
                      {item.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <VideoRowActions
                    id={item.id}
                    isActive={item.is_active}
                    title={item.title ?? "this video"}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination
            page={result.data.pagination.page}
            totalPages={result.data.pagination.total_pages}
            total={result.data.pagination.total}
            showing={result.data.videos.length}
            baseQuery={baseQuery}
            basePath="/admin/videos"
            noun="videos"
            perPage={result.data.pagination.limit}
          />
        </>
      )}
    </div>
  );
}
