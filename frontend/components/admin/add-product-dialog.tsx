"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { ProductFormDialog } from "@/components/admin/product-form/product-form-dialog";
import { Button } from "@/components/ui/button";
import type { TaxonomyOption } from "@/lib/taxonomy-actions";

type Props = {
  categories: TaxonomyOption[];
  brands: TaxonomyOption[];
};

/**
 * The create entry point. Kept at this path and name so the products page
 * import doesn't move; the form itself is shared with editing.
 *
 * `key` remounts the dialog per open, so a cancelled draft never bleeds into
 * the next one.
 */
export function AddProductDialog({ categories, brands }: Props) {
  const [open, setOpen] = useState(false);
  const [instance, setInstance] = useState(0);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setInstance((value) => value + 1);
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <PlusIcon />
        Add product
      </Button>

      {open ? (
        <ProductFormDialog
          key={instance}
          mode="create"
          open={open}
          onOpenChange={handleOpenChange}
          brands={brands}
          categories={categories}
        />
      ) : null}
    </>
  );
}
