"use client";

import { Loader2Icon, PencilIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { ProductFormDialog } from "@/components/admin/product-form/product-form-dialog";
import { Button } from "@/components/ui/button";
import type { AdminProduct } from "@/lib/catalog";
import { loadProductForEditAction } from "@/lib/product-actions";
import type { TaxonomyOption } from "@/lib/taxonomy-actions";

type Props = {
  productId: number;
  productName: string;
  brands: TaxonomyOption[];
  categories: TaxonomyOption[];
};

/**
 * Fetches the product on click rather than shipping two HTML blobs and the
 * full media set down with every row. It also narrows the window in which
 * someone else's edit goes unnoticed — the `updated_at` collected here is what
 * the save is checked against.
 */
export function ProductRowActions({
  productId,
  productName,
  brands,
  categories,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);

    startTransition(async () => {
      const result = await loadProductForEditAction(productId);
      if (result.ok) setProduct(result.product);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={open}
        disabled={pending}
        aria-label={`Edit ${productName}`}
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <PencilIcon />}
        Edit
      </Button>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {product ? (
        // Keyed by id so switching products remounts and re-derives state.
        <ProductFormDialog
          key={product.id}
          mode="edit"
          product={product}
          open
          onOpenChange={(next) => {
            if (!next) setProduct(null);
          }}
          brands={brands}
          categories={categories}
        />
      ) : null}
    </div>
  );
}
