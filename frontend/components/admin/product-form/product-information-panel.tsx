"use client";

import dynamic from "next/dynamic";

import { FieldError } from "@/components/admin/field-error";
import { VariationSection } from "@/components/admin/product-form/variation-section";
import { TaxonomyQuickAdd } from "@/components/admin/product-form/taxonomy-quick-add";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { FormErrors, ProductFormState } from "@/lib/product-form";
import type { TaxonomyOption } from "@/lib/taxonomy-actions";

/**
 * ssr:false keeps ~150KB of ProseMirror out of /admin/products' first load —
 * this dialog is reachable from a server page, so it would otherwise ship
 * whether or not anyone opens it. Valid here because this is a Client
 * Component (node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md).
 */
const RichTextEditor = dynamic(
  () => import("@/components/admin/product-form/rich-text-editor"),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full rounded-4xl" /> }
);

type Props = {
  state: ProductFormState;
  errors: FormErrors;
  disabled: boolean;
  lockedByVariants: boolean;
  brands: TaxonomyOption[];
  categories: TaxonomyOption[];
  set: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  onBrandCreated: (option: TaxonomyOption) => void;
  onCategoryCreated: (option: TaxonomyOption) => void;
};

export function ProductInformationPanel({
  state,
  errors,
  disabled,
  lockedByVariants,
  brands,
  categories,
  set,
  onBrandCreated,
  onCategoryCreated,
}: Props) {
  return (
    <div className="grid content-start gap-5">
      <h3 className="font-heading text-sm font-medium">Product information</h3>

      <div className="grid gap-2">
        <Label htmlFor="product_name">
          Product name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="product_name"
          value={state.product_name}
          onChange={(event) => set("product_name", event.target.value)}
          disabled={disabled}
          maxLength={180}
          autoFocus
        />
        <FieldError messages={errors["product_name"]} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TaxonomyQuickAdd
          kind="brand"
          label="Brand"
          value={state.brand_id}
          options={brands}
          disabled={disabled}
          errors={errors["brand_id"]}
          onChange={(value) => set("brand_id", value)}
          onCreated={onBrandCreated}
        />

        <TaxonomyQuickAdd
          kind="category"
          label="Category"
          value={state.category_id}
          options={categories}
          disabled={disabled}
          errors={errors["category_id"]}
          onChange={(value) => set("category_id", value)}
          onCreated={onCategoryCreated}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="short_description">
          Short description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="short_description"
          value={state.short_description}
          onChange={(event) => set("short_description", event.target.value)}
          disabled={disabled}
          rows={2}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          One or two lines — this is what shows on product cards.
        </p>
        <FieldError messages={errors["short_description"]} />
      </div>

      <div className="grid gap-2">
        <RichTextEditor
          label="Description *"
          initialHtml={state.description}
          onChange={(html) => set("description", html)}
          disabled={disabled}
          invalid={Boolean(errors["description"])}
        />
        <FieldError messages={errors["description"]} />
      </div>

      <RichTextEditor
        label="How to use"
        initialHtml={state.how_to_use}
        onChange={(html) => set("how_to_use", html)}
        disabled={disabled}
      />

      <VariationSection
        state={state}
        errors={errors}
        disabled={disabled}
        lockedByVariants={lockedByVariants}
        set={set}
      />
    </div>
  );
}
