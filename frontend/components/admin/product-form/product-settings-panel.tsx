"use client";

import { FieldError } from "@/components/admin/field-error";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  BADGE_STYLES,
  GST_SLABS,
  type BadgeStyle,
  type ProductImage,
} from "@/lib/catalog";
import type { UploadedImage } from "@/lib/media-upload";
import { MAX_GALLERY_IMAGES } from "@/lib/media-upload";
import type { FormErrors, ProductFormState } from "@/lib/product-form";

type Props = {
  state: ProductFormState;
  errors: FormErrors;
  disabled: boolean;
  /** Images already on the product, when editing. */
  savedMain: ProductImage | null;
  savedGallery: ProductImage[];
  set: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  onMainChange: (images: UploadedImage[]) => void;
  onGalleryChange: (images: UploadedImage[]) => void;
  onRemoveMain: (mediaId: number) => void;
  onRemoveGallery: (mediaId: number) => void;
  onBusyChange: (busy: boolean) => void;
};

function Toggle({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
    </div>
  );
}

export function ProductSettingsPanel({
  state,
  errors,
  disabled,
  savedMain,
  savedGallery,
  set,
  onMainChange,
  onGalleryChange,
  onRemoveMain,
  onRemoveGallery,
  onBusyChange,
}: Props) {
  const badgeLabel = (value: string) =>
    BADGE_STYLES.find((option) => option.value === value)?.label ?? "No badge";

  return (
    <aside className="grid h-fit gap-5 rounded-4xl border p-4">
      <h3 className="font-heading text-sm font-medium">Product settings</h3>

      <div className="grid gap-4">
        <Toggle
          id="status"
          label="Active"
          hint={state.status ? "Visible in the shop" : "Saved as a draft"}
          checked={state.status}
          disabled={disabled}
          onChange={(value) => set("status", value)}
        />
        <Toggle
          id="is_featured"
          label="Featured"
          hint="Shows in featured listings"
          checked={state.is_featured}
          disabled={disabled}
          onChange={(value) => set("is_featured", value)}
        />
        <Toggle
          id="is_combo"
          label="Combo"
          // Honest: the column exists but nothing reads it yet.
          hint="Recorded, but nothing uses it yet"
          checked={state.is_combo}
          disabled={disabled}
          onChange={(value) => set("is_combo", value)}
        />
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="tax_rate">Tax rate</Label>
          <Select
            value={state.tax_rate}
            onValueChange={(value) => set("tax_rate", String(value))}
          >
            <SelectTrigger id="tax_rate" className="w-full" disabled={disabled}>
              {/* Base UI renders the raw value unless given a formatter. */}
              <SelectValue>{(value) => `${Number(value ?? 0).toFixed(2)}%`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {GST_SLABS.map((slab) => (
                <SelectItem key={slab} value={String(slab)}>
                  {slab.toFixed(2)}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError messages={errors["tax_rate"]} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="order_by">Order by</Label>
          <Input
            id="order_by"
            type="number"
            min="0"
            step="1"
            value={state.order_by}
            onChange={(event) => set("order_by", event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <p className="-mt-2 text-xs text-muted-foreground">
        GST is taken out of the sale price, which is treated as tax-inclusive.
      </p>

      <Separator />

      <ImageUploadField
        label="Main image"
        hint="Shown on cards and at the top of the product page."
        disabled={disabled}
        initial={
          savedMain
            ? [{ id: savedMain.id, url: savedMain.url, name: savedMain.name }]
            : undefined
        }
        onChange={onMainChange}
        onRemoveSaved={onRemoveMain}
        onBusyChange={onBusyChange}
      />

      <ImageUploadField
        label="Gallery images"
        hint={`Extra shots for the product page — up to ${MAX_GALLERY_IMAGES}.`}
        multiple
        max={MAX_GALLERY_IMAGES}
        disabled={disabled}
        initial={savedGallery.map((image) => ({
          id: image.id,
          url: image.url,
          name: image.name,
        }))}
        onChange={onGalleryChange}
        onRemoveSaved={onRemoveGallery}
        onBusyChange={onBusyChange}
      />

      <Separator />

      <div className="grid gap-2">
        <Label htmlFor="badge_style">Product card badge</Label>
        <Select
          value={state.badge_style}
          onValueChange={(value) => set("badge_style", String(value) as BadgeStyle)}
        >
          <SelectTrigger id="badge_style" className="w-full" disabled={disabled}>
            <SelectValue>{(value) => badgeLabel(String(value ?? "none"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BADGE_STYLES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Saved on the product; the storefront doesn&rsquo;t render it yet.
        </p>
      </div>
    </aside>
  );
}
