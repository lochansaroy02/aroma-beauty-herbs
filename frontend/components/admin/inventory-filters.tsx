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
import { INVENTORY_FILTERS, INVENTORY_SORTS } from "@/lib/catalog";

type Props = {
  search: string;
  filter: string;
  sort: string;
};

export function InventoryFilters({ search, filter, sort }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Uncontrolled so changing a filter keeps whatever is typed; `key` resets it
  // when the URL's term changes.
  const searchRef = useRef<HTMLInputElement>(null);

  function apply(changes: Partial<Props>) {
    const next = {
      search: searchRef.current?.value.trim() ?? search,
      filter,
      sort,
      ...changes,
    };

    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.filter && next.filter !== "all") params.set("filter", next.filter);
    if (next.sort && next.sort !== "stock_asc") params.set("sort", next.sort);

    const query = params.toString();
    startTransition(() => router.push(`/admin/inventory${query ? `?${query}` : ""}`));
  }

  const hasFilters = Boolean(
    search || (filter && filter !== "all") || (sort && sort !== "stock_asc")
  );

  const sortLabel = (value: string) =>
    INVENTORY_SORTS.find((option) => option.value === value)?.label ?? value;

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <form
        className="flex-1 sm:min-w-56"
        onSubmit={(event) => {
          event.preventDefault();
          apply({});
        }}
      >
        <Label htmlFor="inventory-search">Search</Label>
        <div className="relative mt-2">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="inventory-search"
            key={search}
            ref={searchRef}
            defaultValue={search}
            placeholder="Product name or SKU"
            className="pl-9"
          />
        </div>
      </form>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Show</span>
        <div
          role="group"
          aria-label="Filter stock"
          className="flex gap-1 rounded-4xl bg-muted p-1"
        >
          {INVENTORY_FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? "default" : "ghost"}
              aria-pressed={filter === option.value}
              onClick={() => apply({ filter: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="inventory-sort">Sort</Label>
        <Select value={sort} onValueChange={(value) => apply({ sort: String(value) })}>
          <SelectTrigger id="inventory-sort" className="w-full sm:w-52">
            {/* Base UI renders the raw value unless given a formatter. */}
            <SelectValue>{(value) => sortLabel(String(value))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {INVENTORY_SORTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={() => startTransition(() => router.push("/admin/inventory"))}
        disabled={!hasFilters || pending}
      >
        <XIcon />
        {pending ? "Loading…" : "Clear"}
      </Button>
    </div>
  );
}
