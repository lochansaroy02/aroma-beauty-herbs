"use client";

import { ImageIcon, Loader2Icon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { removeCartItemAction, updateCartItemAction } from "@/lib/cart-actions";
import { formatPrice, type CartItem } from "@/lib/catalog";

/** Matches the API's per-line cap. */
const MAX_QUANTITY = 99;

export function CartLine({ item }: { item: CartItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setQuantity(next: number) {
    if (next < 1 || next > MAX_QUANTITY || next === item.quantity) return;
    setError(null);

    startTransition(async () => {
      const result = await updateCartItemAction(item.id, next);
      if (!result.ok) setError(result.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeCartItemAction(item.id);
      if (!result.ok) setError(result.error);
    });
  }

  const image = item.product.image;
  const href = `/products/${item.product.slug}`;
  const atCeiling = item.quantity >= Math.min(MAX_QUANTITY, item.available_qty);

  return (
    <div className="flex gap-4 py-5">
      <Link
        href={href}
        className="relative size-20 shrink-0 overflow-hidden rounded-md border bg-muted"
      >
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? item.product.product_name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-5" />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={href} className="font-medium hover:underline">
              {item.product.product_name}
            </Link>
            {item.variant?.variation_name &&
            item.variant.variation_name !== "Default" ? (
              <p className="text-xs text-muted-foreground">
                {item.variant.variation_name}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatPrice(item.unit_price)} each
            </p>
          </div>

          <span className="shrink-0 font-medium tabular-nums">
            {formatPrice(item.line_total)}
          </span>
        </div>

        {item.unavailable ? (
          <Badge variant="destructive" className="w-fit">
            {item.available_qty === 0
              ? "Out of stock"
              : `Only ${item.available_qty} left`}
          </Badge>
        ) : null}

        {item.price_changed ? (
          <p className="text-xs text-muted-foreground">
            Price changed from {formatPrice(item.price_at_add)} since you added this.
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setQuantity(item.quantity - 1)}
              disabled={pending || item.quantity <= 1}
              aria-label="Decrease quantity"
            >
              <MinusIcon className="size-3.5" />
            </Button>
            <span className="w-8 text-center text-sm tabular-nums">
              {pending ? (
                <Loader2Icon className="mx-auto size-3.5 animate-spin" />
              ) : (
                item.quantity
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setQuantity(item.quantity + 1)}
              disabled={pending || atCeiling}
              aria-label="Increase quantity"
            >
              <PlusIcon className="size-3.5" />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={pending}
            className="text-muted-foreground"
          >
            <Trash2Icon className="size-3.5" />
            Remove
          </Button>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
