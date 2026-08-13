"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortOption = { value: string; label: string };

type Props = {
  search: string;
  sort: string;
  sorts: readonly SortOption[];
};

export function ShopFilters({ search, sort, sorts }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Uncontrolled so changing the sort keeps whatever is typed; `key` resets it
  // when the URL's term changes.
  const searchRef = useRef<HTMLInputElement>(null);

  function apply(changes: { search?: string; sort?: string }) {
    const next = {
      search: changes.search ?? searchRef.current?.value.trim() ?? search,
      sort: changes.sort ?? sort,
    };

    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.sort && next.sort !== "newest") params.set("sort", next.sort);

    const query = params.toString();
    startTransition(() => router.push(`/products${query ? `?${query}` : ""}`));
  }

  const sortLabel = (value: string) =>
    sorts.find((option) => option.value === value)?.label ?? value;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <form
        className="flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          apply({});
        }}
      >
        <Label htmlFor="shop-search" className="sr-only">
          Search products
        </Label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="shop-search"
            key={search}
            ref={searchRef}
            name="search"
            defaultValue={search}
            placeholder="Search the range"
            className="pl-9"
          />
        </div>
      </form>

      <Select value={sort} onValueChange={(value) => apply({ sort: String(value) })}>
        <SelectTrigger className="w-full sm:w-52" aria-label="Sort products">
          {/* Base UI renders the raw value unless given a formatter. */}
          <SelectValue>{(value) => sortLabel(String(value))}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sorts.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
