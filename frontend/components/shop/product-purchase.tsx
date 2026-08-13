"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { WishlistButton } from "@/components/shop/wishlist-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice, type ProductVariant } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type Props = {
  productId: number;
  variants: ProductVariant[];
  saved: boolean;
};

/** Matches the API's per-line cap. */
const MAX_QUANTITY = 99;

function variantLabel(variant: ProductVariant): string {
  return variant.variation_name ?? variant.sku;
}

export function ProductPurchase({ productId, variants, saved }: Props) {
  const [variantId, setVariantId] = useState(() => String(variants[0]?.id ?? ""));
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const variant = variants.find((option) => String(option.id) === variantId) ?? variants[0];
  const available = variant?.available_qty ?? 0;
  const ceiling = Math.min(MAX_QUANTITY, Math.max(available, 1));

  function step(by: number) {
    setError(null);
    setQuantity((current) => Math.min(ceiling, Math.max(1, current + by)));
  }

  if (!variant) {
    return (
      <Alert>
        <AlertDescription>This product isn&rsquo;t available to buy yet.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-6 border-t border-ink/10 pt-8">
      <div className="flex items-baseline gap-3">
        <span
          className="font-heading text-[2.25rem] leading-none text-ink"
          style={{ fontVariationSettings: '"SOFT" 40, "WONK" 0, "opsz" 48' }}
        >
          {formatPrice(variant.price?.sale_price ?? null)}
        </span>
        {variant.price?.mrp != null &&
        variant.price.sale_price != null &&
        variant.price.mrp > variant.price.sale_price ? (
          <span className="text-[15px] text-clay line-through tabular-nums">
            {formatPrice(variant.price.mrp)}
          </span>
        ) : null}
      </div>

      {variants.length > 1 ? (
        <div className="grid gap-2">
          <Label
            htmlFor="variant"
            className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase"
          >
            Option
          </Label>
          <Select
            value={variantId}
            onValueChange={(value) => {
              setVariantId(String(value));
              // A different option can have less stock than the current count.
              setQuantity(1);
              setError(null);
            }}
          >
            <SelectTrigger id="variant" className="w-full sm:w-64">
              <SelectValue>
                {(value) => {
                  const match = variants.find((option) => String(option.id) === String(value));
                  return match ? variantLabel(match) : "Choose an option";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {variants.map((option) => (
                <SelectItem
                  key={option.id}
                  value={String(option.id)}
                  disabled={option.available_qty <= 0}
                >
                  {variantLabel(option)}
                  {option.available_qty <= 0 ? " — out of stock" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="grid gap-2">
        <span className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
          Quantity
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-ink/20">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => step(-1)}
              disabled={quantity <= 1 || available <= 0}
              aria-label="Decrease quantity"
            >
              <MinusIcon />
            </Button>
            <span className="w-10 text-center text-ink tabular-nums" aria-live="polite">
              {quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => step(1)}
              disabled={quantity >= ceiling || available <= 0}
              aria-label="Increase quantity"
            >
              <PlusIcon />
            </Button>
          </div>

          <span
            className={cn(
              "font-mono text-[11px] tracking-[0.14em] uppercase",
              available > 0 ? "text-ink-soft" : "text-destructive"
            )}
          >
            {available > 0 ? `${available} in stock` : "Out of stock"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <AddToCartButton
          productId={productId}
          variantId={variant.id}
          quantity={quantity}
          disabled={available <= 0}
          size="lg"
          onError={setError}
        />
        <WishlistButton productId={productId} saved={saved} variant="labelled" />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
