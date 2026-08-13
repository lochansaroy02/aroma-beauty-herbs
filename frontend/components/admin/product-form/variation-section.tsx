"use client";

import { InfoIcon } from "lucide-react";

import { FieldError } from "@/components/admin/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormErrors, ProductFormState } from "@/lib/product-form";

type Props = {
  state: ProductFormState;
  errors: FormErrors;
  disabled: boolean;
  /** Locked when the product already has more than one variant. */
  lockedByVariants: boolean;
  set: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
};

export function VariationSection({
  state,
  errors,
  disabled,
  lockedByVariants,
  set,
}: Props) {
  const locked = disabled || lockedByVariants;

  return (
    <section className="grid gap-4 rounded-4xl border p-4">
      <h3 className="font-heading text-sm font-medium">Product type &amp; variations</h3>

      {/* Hand-rolled: no RadioGroup exists in this project, and one of the two
          options is disabled anyway. */}
      <div role="group" aria-label="Product type" className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="default" aria-pressed>
          Simple product
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled aria-pressed={false}>
          Variable product
        </Button>
        <span className="flex items-center gap-1 self-center text-xs text-muted-foreground">
          <InfoIcon className="size-3" />
          Variations aren&rsquo;t built yet
        </span>
      </div>

      {lockedByVariants ? (
        <p className="text-xs text-muted-foreground">
          This product has more than one variant, so pricing and stock are managed from
          Inventory.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="sku">
            SKU <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sku"
            value={state.sku}
            onChange={(event) => set("sku", event.target.value)}
            disabled={locked}
            maxLength={80}
            placeholder="NFW-001"
          />
          <FieldError messages={errors["sku"]} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="mrp">
            MRP (₹) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="mrp"
            type="number"
            min="0"
            step="1"
            value={state.mrp}
            onChange={(event) => set("mrp", event.target.value)}
            disabled={locked}
          />
          <FieldError messages={errors["mrp"]} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sale_price">
            Sale price (₹) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sale_price"
            type="number"
            min="0"
            step="1"
            value={state.sale_price}
            onChange={(event) => set("sale_price", event.target.value)}
            disabled={locked}
          />
          <FieldError messages={errors["sale_price"]} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="stock_qty">
            Stock <span className="text-destructive">*</span>
          </Label>
          <Input
            id="stock_qty"
            type="number"
            min="0"
            step="1"
            value={state.stock_qty}
            onChange={(event) => set("stock_qty", event.target.value)}
            disabled={locked}
          />
          <FieldError messages={errors["stock_qty"]} />
        </div>
      </div>

      <div className="grid gap-2 sm:max-w-48">
        <Label htmlFor="low_stock_alert">Low stock alert</Label>
        <Input
          id="low_stock_alert"
          type="number"
          min="0"
          step="1"
          value={state.low_stock_alert}
          onChange={(event) => set("low_stock_alert", event.target.value)}
          disabled={locked}
        />
        <p className="text-xs text-muted-foreground">
          Flags this product in Inventory once available stock drops this low. Zero turns
          the alert off.
        </p>
      </div>
    </section>
  );
}
