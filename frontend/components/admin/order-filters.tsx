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
import { ADMIN_ORDER_SORTS, ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/catalog";

type Props = {
  search: string;
  status: string;
  paymentStatus: string;
  sort: string;
};

const ANY = "";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function OrderFilters({ search, status, paymentStatus, sort }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Uncontrolled so changing a dropdown keeps whatever is typed; `key` resets
  // it when the URL's term changes.
  const searchRef = useRef<HTMLInputElement>(null);

  function apply(changes: Partial<Props>) {
    const next = {
      search: searchRef.current?.value.trim() ?? search,
      status,
      paymentStatus,
      sort,
      ...changes,
    };

    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status) params.set("status", next.status);
    if (next.paymentStatus) params.set("payment_status", next.paymentStatus);
    if (next.sort && next.sort !== "newest") params.set("sort", next.sort);

    const query = params.toString();
    startTransition(() => router.push(`/admin/orders${query ? `?${query}` : ""}`));
  }

  const hasFilters = Boolean(
    search || status || paymentStatus || (sort && sort !== "newest")
  );

  const sortLabel = (value: string) =>
    ADMIN_ORDER_SORTS.find((option) => option.value === value)?.label ?? value;

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <form
        className="flex-1 sm:min-w-56"
        onSubmit={(event) => {
          event.preventDefault();
          apply({});
        }}
      >
        <Label htmlFor="order-search">Search</Label>
        <div className="relative mt-2">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="order-search"
            key={search}
            ref={searchRef}
            defaultValue={search}
            placeholder="Order number, name, email"
            className="pl-9"
          />
        </div>
      </form>

      <div className="grid gap-2">
        <Label htmlFor="order-status">Order status</Label>
        <Select value={status} onValueChange={(value) => apply({ status: String(value) })}>
          <SelectTrigger id="order-status" className="w-full sm:w-40">
            {/* Base UI renders the raw value unless given a formatter. */}
            <SelectValue>
              {(value) => (value ? titleCase(String(value)) : "All")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All</SelectItem>
            {ORDER_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {titleCase(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="payment-status">Payment</Label>
        <Select
          value={paymentStatus}
          onValueChange={(value) => apply({ paymentStatus: String(value) })}
        >
          <SelectTrigger id="payment-status" className="w-full sm:w-40">
            <SelectValue>
              {(value) => (value ? titleCase(String(value)) : "All")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All</SelectItem>
            {PAYMENT_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {titleCase(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="order-sort">Sort</Label>
        <Select value={sort} onValueChange={(value) => apply({ sort: String(value) })}>
          <SelectTrigger id="order-sort" className="w-full sm:w-44">
            <SelectValue>{(value) => sortLabel(String(value))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ADMIN_ORDER_SORTS.map((option) => (
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
        onClick={() => startTransition(() => router.push("/admin/orders"))}
        disabled={!hasFilters || pending}
      >
        <XIcon />
        {pending ? "Loading…" : "Clear"}
      </Button>
    </div>
  );
}
