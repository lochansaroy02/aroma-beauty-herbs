"use client";

import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { discardUploads } from "@/lib/media-actions";
import {
  ACCEPT_ATTRIBUTE,
  UploadError,
  uploadMedia,
  validateImage,
  type UploadedImage,
} from "@/lib/media-upload";
import { cn } from "@/lib/utils";

/** An image already attached to the product, loaded from the API. */
export type SavedImage = { id: number; url: string; name: string };

/**
 * Origin is what keeps editing safe. A "local" item owns a freshly uploaded
 * stored file that nothing references yet, so abandoning it should delete it.
 * A "saved" item is a live product photo — removing it here only records the
 * intent, and the server deletes it when the form is actually saved. Cancel the
 * dialog and nothing is lost.
 */
type Item =
  | {
      origin: "local";
      key: string;
      /** Object URL of the local file, shown while and after uploading. */
      preview: string;
      /** Present once the API has stored the file. */
      uploaded?: UploadedImage;
      error?: string;
    }
  | { origin: "saved"; key: string; mediaId: number; url: string; name: string };

type Props = {
  label: string;
  hint?: string;
  /** Single slot (the main image) or a growing gallery. */
  multiple?: boolean;
  max?: number;
  disabled?: boolean;
  /** Images already on the product, when editing. */
  initial?: SavedImage[];
  onChange: (images: UploadedImage[]) => void;
  /** Records that a saved image should be detached on save. No network call. */
  onRemoveSaved?: (mediaId: number) => void;
  /** Raised while a file is in flight, so the form can hold back submit. */
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Only newly uploaded files — which is exactly what the API's `main_image` and
 * `gallery_add` expect. Saved images are already attached and must not be
 * resubmitted.
 */
function uploadedOf(items: Item[]): UploadedImage[] {
  return items
    .filter((item) => item.origin === "local")
    .map((item) => item.uploaded)
    .filter((image): image is UploadedImage => Boolean(image));
}

function toSavedItem(image: SavedImage): Item {
  return {
    origin: "saved",
    key: `saved-${image.id}`,
    mediaId: image.id,
    url: image.url,
    name: image.name,
  };
}

/** Local previews are object URLs and must be revoked; saved ones are plain URLs. */
function revoke(item: Item) {
  if (item.origin === "local") URL.revokeObjectURL(item.preview);
}

export function ImageUploadField({
  label,
  hint,
  multiple = false,
  max = 10,
  disabled = false,
  initial,
  onChange,
  onRemoveSaved,
  onBusyChange,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Seeded in the initialiser, not an effect, so `onChange` is never called
  // during render.
  const [items, setItems] = useState<Item[]>(() => (initial ?? []).map(toSavedItem));

  // Mirrors `items` so the async upload callbacks can compute the next list
  // without a functional updater — the parent must be notified from an event,
  // never from inside a state updater or an effect.
  const itemsRef = useRef<Item[]>(items);

  useEffect(() => {
    const current = itemsRef;
    // Without this the object URLs leak for as long as the page lives.
    return () => {
      for (const item of current.current) revoke(item);
    };
  }, []);

  function commit(next: Item[]) {
    itemsRef.current = next;
    setItems(next);
    onChange(uploadedOf(next));
    onBusyChange?.(
      next.some((item) => item.origin === "local" && !item.uploaded && !item.error)
    );
  }

  function patch(key: string, changes: { uploaded?: UploadedImage; error?: string }) {
    commit(
      itemsRef.current.map((item) =>
        item.key === key && item.origin === "local" ? { ...item, ...changes } : item
      )
    );
  }

  async function handleFiles(files: File[]) {
    if (!files.length) return;

    const room = multiple ? Math.max(0, max - itemsRef.current.length) : 1;
    const accepted = files.slice(0, room);
    if (!accepted.length) return;

    const replaced = multiple ? [] : itemsRef.current;

    const pending: Item[] = accepted.map((file) => {
      const invalid = validateImage(file);
      return {
        origin: "local" as const,
        key: crypto.randomUUID(),
        preview: URL.createObjectURL(file),
        ...(invalid ? { error: invalid } : {}),
      };
    });

    commit(multiple ? [...itemsRef.current, ...pending] : pending);

    for (const item of replaced) revoke(item);

    // Only local uploads are ours to delete. A replaced *saved* main image is
    // the server's to clean up once the form is saved — deleting it here would
    // destroy a live photo on a form the admin might still cancel.
    const orphans = uploadedOf(replaced).map((image) => image.file_id);
    if (orphans.length) void discardUploads(orphans);

    for (const item of replaced) {
      if (item.origin === "saved") onRemoveSaved?.(item.mediaId);
    }

    await Promise.all(
      accepted.map(async (file, index) => {
        const item = pending[index]!;
        if (item.origin !== "local" || item.error) return;

        try {
          patch(item.key, { uploaded: await uploadMedia(file) });
        } catch (error) {
          patch(item.key, {
            error:
              error instanceof UploadError ? error.message : "Upload failed. Try again.",
          });
        }
      })
    );
  }

  function remove(key: string) {
    const target = itemsRef.current.find((item) => item.key === key);

    if (target?.origin === "local") {
      revoke(target);
      if (target.uploaded) void discardUploads([target.uploaded.file_id]);
    } else if (target?.origin === "saved") {
      // Intent only — the server detaches and deletes it on save.
      onRemoveSaved?.(target.mediaId);
    }

    commit(itemsRef.current.filter((item) => item.key !== key));
  }

  const full = items.length >= (multiple ? max : 1);

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple={multiple}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Reset so picking the same file again still fires a change.
          event.target.value = "";
          void handleFiles(files);
        }}
      />

      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const settled = item.origin === "saved" || Boolean(item.uploaded);
          const failed = item.origin === "local" && Boolean(item.error);
          const src = item.origin === "saved" ? item.url : item.preview;
          const name =
            item.origin === "saved" ? item.name : (item.uploaded?.name ?? "image");

          return (
            <div
              key={item.key}
              className={cn(
                "relative size-20 overflow-hidden rounded-md border bg-muted",
                failed && "border-destructive"
              )}
            >
              {/* One render path for both: a blob URL can't go through the
                  image optimizer, and a saved URL gains nothing at 80px. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className={cn("size-full object-cover", !settled && "opacity-40")}
              />

              {!settled && !failed ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2Icon className="size-5 animate-spin" />
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => remove(item.key)}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow-sm hover:bg-background"
                aria-label={`Remove ${name}`}
              >
                <XIcon className="size-3" />
              </button>
            </div>
          );
        })}

        {!full ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="size-20 flex-col gap-1 border-dashed p-0 text-xs font-normal text-muted-foreground"
          >
            <ImagePlusIcon className="size-5" />
            {multiple ? "Add" : "Upload"}
          </Button>
        ) : null}
      </div>

      {items
        .filter((item) => item.origin === "local" && item.error)
        .map((item) => (
          <p key={`${item.key}-error`} className="text-sm text-destructive">
            {item.origin === "local" ? item.error : null}
          </p>
        ))}

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
