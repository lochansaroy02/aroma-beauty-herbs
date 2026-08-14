"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTACT_PAGE_SIZES,
  CONTACT_SORTS,
  CONTACT_STATUSES,
} from "@/lib/catalog";

type Props = {
  search: string;
  status: string;
  sort: string;
  limit: number;
};

const ANY = "";

/** One filter row above the table, matching the orders and inventory screens. */
export function ContactFilters({ search, status, sort, limit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Uncontrolled so changing a dropdown keeps whatever is typed; `key` resets
  // it when the URL's term changes.
  const searchRef = useRef<HTMLInputElement>(null);

  function apply(changes: Partial<Props>) {
    const next = {
      search: searchRef.current?.value.trim() ?? search,
      status,
      sort,
      limit,
      ...changes,
    };

    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status) params.set("status", next.status);
    if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
    if (next.limit && next.limit !== 50) params.set("limit", String(next.limit));

    const query = params.toString();
    // `page` is deliberately dropped: after changing a filter, page 4 of the
    // old result set is meaningless and often empty.
    startTransition(() => router.push(`/admin/queries${query ? `?${query}` : ""}`));
  }

  const hasFilters = Boolean(
    search || status || (sort && sort !== "newest") || limit !== 50
  );

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <form
        className="flex-1 sm:min-w-56"
        onSubmit={(event) => {
          event.preventDefault();
          apply({});
        }}
      >
        <Label htmlFor="contact-search">Search</Label>
        <div className="relative mt-2">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="contact-search"
            key={search}
            ref={searchRef}
            defaultValue={search}
            placeholder="Name, email, phone or message"
            className="pl-9"
          />
        </div>
      </form>

      <div className="grid gap-2">
        <Label htmlFor="contact-status">Status</Label>
        <Select value={status} onValueChange={(value) => apply({ status: String(value) })}>
          <SelectTrigger id="contact-status" className="w-full sm:w-40">
            <SelectValue>
              {(value) =>
                value
                  ? (CONTACT_STATUSES.find((o) => o.value === value)?.label ??
                    String(value))
                  : "All"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All</SelectItem>
            {CONTACT_STATUSES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contact-sort">Sort</Label>
        <Select value={sort} onValueChange={(value) => apply({ sort: String(value) })}>
          <SelectTrigger id="contact-sort" className="w-full sm:w-44">
            <SelectValue>
              {(value) =>
                CONTACT_SORTS.find((o) => o.value === value)?.label ?? String(value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CONTACT_SORTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contact-limit">Show</Label>
        <Select
          value={String(limit)}
          onValueChange={(value) => apply({ limit: Number(value) })}
        >
          <SelectTrigger id="contact-limit" className="w-full sm:w-28">
            <SelectValue>{(value) => String(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CONTACT_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={() => startTransition(() => router.push("/admin/queries"))}
        disabled={!hasFilters || pending}
      >
        <XIcon />
        {pending ? "Loading…" : "Clear"}
      </Button>
    </div>
  );
}
