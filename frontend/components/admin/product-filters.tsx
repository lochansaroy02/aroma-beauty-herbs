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

type SortOption = { value: string; label: string };

type Props = {
  search: string;
  sort: string;
  featured: string;
  sorts: readonly SortOption[];
};

const FEATURED_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

export function ProductFilters({ search, sort, featured, sorts }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Uncontrolled, so changing a filter still picks up whatever was typed.
  // The `key` below resets it whenever the URL's search term changes.
  const searchRef = useRef<HTMLInputElement>(null);

  function apply(changes: Record<string, string>) {
    const params = new URLSearchParams();
    const typed = searchRef.current?.value.trim() ?? search;
    const next = { search: typed, sort, featured, ...changes };

    if (next.search) params.set("search", next.search);
    if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
    if (next.featured) params.set("featured", next.featured);

    // Any filter change invalidates the current page number.
    const query = params.toString();
    startTransition(() => router.push(`/admin/products${query ? `?${query}` : ""}`));
  }

  const hasFilters = Boolean(search || featured || (sort && sort !== "newest"));
  const sortLabel = (value: string) =>
    sorts.find((option) => option.value === value)?.label ?? value;

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <form
        className="flex-1 sm:min-w-64"
        onSubmit={(event) => {
          event.preventDefault();
          apply({});
        }}
      >
        <Label htmlFor="product-search">Search</Label>
        <div className="relative mt-2">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="product-search"
            key={search}
            ref={searchRef}
            name="search"
            defaultValue={search}
            placeholder="Name or product code"
            className="pl-9"
          />
        </div>
      </form>

      <div className="grid gap-2">
        <Label htmlFor="product-sort">Sort</Label>
        <Select value={sort} onValueChange={(value) => apply({ sort: String(value) })}>
          <SelectTrigger id="product-sort" className="w-full sm:w-52">
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

      <div className="grid gap-2">
        <span className="text-sm font-medium">Featured</span>
        <div
          role="group"
          aria-label="Filter by featured"
          className="flex gap-1 rounded-4xl bg-muted p-1"
        >
          {FEATURED_OPTIONS.map((option) => (
            <Button
              key={option.value || "all"}
              type="button"
              size="sm"
              variant={featured === option.value ? "default" : "ghost"}
              aria-pressed={featured === option.value}
              onClick={() => apply({ featured: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={() => startTransition(() => router.push("/admin/products"))}
        disabled={!hasFilters || pending}
      >
        <XIcon />
        {pending ? "Loading…" : "Clear"}
      </Button>
    </div>
  );
}
