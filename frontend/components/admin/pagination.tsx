import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  showing: number;
  /** Current query string without `page`, e.g. "search=neem&sort=name_asc". */
  baseQuery: string;
  /** Path the page links point at. */
  basePath?: string;
  /** What's being paged, for the count line and the nav label. */
  noun?: string;
  /** Page size, so the "1–20 of 57" range is right. */
  perPage?: number;
};

function href(page: number, baseQuery: string, basePath: string) {
  const params = new URLSearchParams(baseQuery);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
}

/**
 * Two distinct elements rather than one with a conditional `render`: a link when
 * navigable, a real disabled <button> otherwise. Base UI needs to know which it
 * is, so `nativeButton` can't be set blindly.
 */
function PageButton({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} />}>
      {children}
    </Button>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  showing,
  baseQuery,
  basePath = "/admin/products",
  noun = "products",
  perPage = 20,
}: Props) {
  const first = total === 0 ? 0 : (page - 1) * perPage + 1;

  return (
    <nav
      aria-label={`${noun} pages`}
      className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        {total === 0 ? `No ${noun}` : `${first}–${first + showing - 1} of ${total}`}
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <PageButton href={page > 1 ? href(page - 1, baseQuery, basePath) : null}>
            <ChevronLeftIcon />
            Previous
          </PageButton>

          <span className="px-1 text-sm tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>

          <PageButton href={page < totalPages ? href(page + 1, baseQuery, basePath) : null}>
            Next
            <ChevronRightIcon />
          </PageButton>
        </div>
      ) : null}
    </nav>
  );
}
