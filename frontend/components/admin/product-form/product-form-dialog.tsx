"use client";

import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { ProductInformationPanel } from "@/components/admin/product-form/product-information-panel";
import { ProductSettingsPanel } from "@/components/admin/product-form/product-settings-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminProduct } from "@/lib/catalog";
import { discardUploads } from "@/lib/media-actions";
import type { UploadedImage } from "@/lib/media-upload";
import {
  createProductAction,
  updateProductAction,
  type SaveProductResult,
} from "@/lib/product-actions";
import {
  emptyState,
  fromProduct,
  pendingUploadIds,
  validate,
  type ProductFormState,
} from "@/lib/product-form";
import type { TaxonomyOption } from "@/lib/taxonomy-actions";

/**
 * Locally created options are held separately from the server's list, and the
 * two overlap in two ways: creating a brand revalidates the page, so the new
 * row arrives from the server as well; and a duplicate-name 409 hands back a
 * row that was in the list all along. Either way the id would appear twice and
 * React would warn about duplicate keys, so the merge is deduplicated by id.
 */
function mergeOptions(
  fromServer: TaxonomyOption[],
  local: TaxonomyOption[]
): TaxonomyOption[] {
  const byId = new Map<number, TaxonomyOption>();
  for (const option of [...fromServer, ...local]) byId.set(option.id, option);
  return [...byId.values()];
}

type Mode = { mode: "create" } | { mode: "edit"; product: AdminProduct };

type Props = Mode & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brands: TaxonomyOption[];
  categories: TaxonomyOption[];
};

export function ProductFormDialog(props: Props) {
  const { open, onOpenChange, brands, categories } = props;
  const editing = props.mode === "edit" ? props.product : null;

  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Derived once. The caller remounts with `key={product.id}`, so there's no
  // derive-state-from-props hazard and the editors get fresh content without a
  // setContent call that would destroy the cursor.
  const [state, setState] = useState<ProductFormState>(() =>
    editing ? fromProduct(editing) : emptyState()
  );

  const [extraBrands, setExtraBrands] = useState<TaxonomyOption[]>([]);
  const [extraCategories, setExtraCategories] = useState<TaxonomyOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<SaveProductResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const set = useCallback(
    <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
      setState((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const clientErrors = useMemo(() => validate(state), [state]);
  const serverErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  // Client errors stay hidden until the first save attempt — flagging empty
  // fields the moment the dialog opens is hostile.
  const errors = showErrors ? { ...clientErrors, ...serverErrors } : serverErrors;

  const formError =
    result && !result.ok && !result.fieldErrors ? result.error : undefined;

  const allBrands = useMemo(() => mergeOptions(brands, extraBrands), [brands, extraBrands]);
  const allCategories = useMemo(
    () => mergeOptions(categories, extraCategories),
    [categories, extraCategories]
  );

  const lockedByVariants = (editing?.variant_count ?? 1) > 1;
  const busy = pending || uploading;

  function handleOpenChange(next: boolean) {
    if (!next && !pending) {
      // Uploads made for a form that was never saved belong to nobody.
      const orphans = pendingUploadIds(state);
      if (orphans.length) void discardUploads(orphans);
    }
    onOpenChange(next);
  }

  const handleMainChange = useCallback((images: UploadedImage[]) => {
    setState((current) => ({
      ...current,
      main_image: images[0] ?? null,
      // A replacement supersedes the removal; the server swaps it either way.
      remove_main_image: images[0] ? false : current.remove_main_image,
    }));
  }, []);

  const handleGalleryChange = useCallback((images: UploadedImage[]) => {
    setState((current) => ({ ...current, gallery_add: images }));
  }, []);

  const handleRemoveMain = useCallback(() => {
    setState((current) => ({ ...current, remove_main_image: true }));
  }, []);

  const handleRemoveGallery = useCallback((mediaId: number) => {
    setState((current) => ({
      ...current,
      removed_media: [...current.removed_media, mediaId],
    }));
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);
    setResult(null);

    if (Object.keys(clientErrors).length > 0) return;

    startTransition(async () => {
      const response = editing
        ? await updateProductAction(editing.id, state, editing.updated_at)
        : await createProductAction(state);

      setResult(response);

      if (response.ok) {
        // Saved images now belong to the product — don't clean them up.
        setState((current) => ({
          ...current,
          main_image: null,
          gallery_add: [],
          removed_media: [],
          remove_main_image: false,
        }));
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">
            {editing ? "Edit product" : "Add product"}
          </DialogTitle>
          <DialogDescription>
            {editing ? (
              <>
                Code <span className="font-mono">{editing.product_code}</span> and the URL
                are fixed after creation, so existing links keep working.
              </>
            ) : (
              "The slug and product code are generated from the name, and can't be changed later."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-6">
          {formError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {showErrors && Object.keys(clientErrors).length > 0 ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>
                Some required fields still need filling in.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <ProductInformationPanel
              state={state}
              errors={errors}
              disabled={busy}
              lockedByVariants={lockedByVariants}
              brands={allBrands}
              categories={allCategories}
              set={set}
              onBrandCreated={(option) =>
                setExtraBrands((current) => [...current, option])
              }
              onCategoryCreated={(option) =>
                setExtraCategories((current) => [...current, option])
              }
            />

            <ProductSettingsPanel
              state={state}
              errors={errors}
              disabled={busy}
              savedMain={editing?.main_image ?? null}
              savedGallery={editing?.gallery ?? []}
              set={set}
              onMainChange={handleMainChange}
              onGalleryChange={handleGalleryChange}
              onRemoveMain={handleRemoveMain}
              onRemoveGallery={handleRemoveGallery}
              onBusyChange={setUploading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Close
            </Button>
            <Button type="submit" disabled={busy}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {uploading
                ? "Uploading images…"
                : pending
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Save product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
