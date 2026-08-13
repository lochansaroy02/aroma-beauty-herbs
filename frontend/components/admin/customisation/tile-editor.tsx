"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImageIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminTile } from "@/lib/catalog";
import {
  createTileAction,
  deleteTileAction,
  reorderTilesAction,
  updateTileAction,
} from "@/lib/home-actions";
import { ACCEPT_ATTRIBUTE, UploadError, uploadMedia } from "@/lib/media-upload";

/**
 * The closing grid.
 *
 * Text saves on blur; the image uploads immediately on pick, because a file
 * input that appears to do nothing until a separate save is the most common way
 * an admin loses an upload.
 */
export function TileEditor({ tiles }: { tiles: AdminTile[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "That didn't save.");
    });
  }

  function add() {
    const title = draft.trim();
    if (!title) return;

    run(async () => {
      const result = await createTileAction({
        title,
        caption: null,
        url: "/products",
        is_active: true,
      });
      if (result.ok) setDraft("");
      return result;
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= tiles.length) return;

    const next = tiles.map((tile) => tile.id);
    const [id] = next.splice(index, 1);
    if (id !== undefined) next.splice(target, 0, id);
    run(() => reorderTilesAction(next));
  }

  async function pickImage(tileId: number, file: File) {
    setError(null);
    setUploadingId(tileId);

    try {
      const uploaded = await uploadMedia(file, "image");
      startTransition(async () => {
        const result = await updateTileAction(tileId, { image: uploaded });
        if (!result.ok) setError(result.error);
        setUploadingId(null);
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof UploadError ? uploadError.message : "The upload failed."
      );
      setUploadingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Tile grid</CardTitle>
        <CardDescription>
          The closing grid of links. Without an image a tile falls back to a tinted panel.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <ul className="grid gap-3">
          {tiles.map((tile, index) => (
            <TileRow
              key={tile.id}
              tile={tile}
              index={index}
              total={tiles.length}
              pending={pending}
              uploading={uploadingId === tile.id}
              onMove={move}
              onSave={(changes) => run(() => updateTileAction(tile.id, changes))}
              onDelete={() => run(() => deleteTileAction(tile.id))}
              onPickImage={(file) => void pickImage(tile.id, file)}
            />
          ))}
        </ul>

        {tiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tiles yet — the grid won&rsquo;t render until you add one.
          </p>
        ) : null}

        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ingredients"
            maxLength={120}
            disabled={pending}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" onClick={add} disabled={!draft.trim() || pending}>
            <PlusIcon />
            Add tile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type RowProps = {
  tile: AdminTile;
  index: number;
  total: number;
  pending: boolean;
  uploading: boolean;
  onMove: (index: number, delta: number) => void;
  onSave: (changes: { title?: string; caption?: string | null; url?: string | null; is_active?: boolean }) => void;
  onDelete: () => void;
  onPickImage: (file: File) => void;
};

function TileRow({
  tile,
  index,
  total,
  pending,
  uploading,
  onMove,
  onSave,
  onDelete,
  onPickImage,
}: RowProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <li className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_auto_1fr]">
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onMove(index, -1)}
          disabled={index === 0 || pending}
          aria-label={`Move ${tile.title ?? "tile"} up`}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1 || pending}
          aria-label={`Move ${tile.title ?? "tile"} down`}
        >
          <ArrowDownIcon />
        </Button>
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending || uploading}
        className="relative size-20 shrink-0 overflow-hidden rounded border bg-muted transition-opacity hover:opacity-80"
        aria-label={`Change image for ${tile.title ?? "tile"}`}
      >
        {tile.image ? (
          <Image src={tile.image.url} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageIcon className="size-4" />
            <span className="text-[10px]">Add</span>
          </span>
        )}

        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2Icon className="size-4 animate-spin" />
          </span>
        ) : null}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPickImage(file);
          event.target.value = "";
        }}
      />

      <div className="grid gap-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor={`tile-title-${tile.id}`} className="text-xs">Title</Label>
            <Input
              id={`tile-title-${tile.id}`}
              defaultValue={tile.title ?? ""}
              maxLength={120}
              disabled={pending}
              onBlur={(event) => {
                const title = event.target.value.trim();
                if (title && title !== tile.title) onSave({ title });
              }}
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor={`tile-url-${tile.id}`} className="text-xs">Links to</Label>
            <Input
              id={`tile-url-${tile.id}`}
              defaultValue={tile.url ?? ""}
              placeholder="/products"
              maxLength={500}
              disabled={pending}
              onBlur={(event) => {
                const url = event.target.value.trim() || null;
                if (url !== tile.url) onSave({ url });
              }}
            />
          </div>
        </div>

        <div className="grid gap-1">
          <Label htmlFor={`tile-caption-${tile.id}`} className="text-xs">Standfirst</Label>
          <Input
            id={`tile-caption-${tile.id}`}
            defaultValue={tile.caption ?? ""}
            placeholder="What goes in, and what never does"
            maxLength={200}
            disabled={pending}
            onBlur={(event) => {
              const caption = event.target.value.trim() || null;
              if (caption !== tile.caption) onSave({ caption });
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={pending || uploading}
          >
            <UploadIcon />
            {tile.image ? "Replace image" : "Upload image"}
          </Button>

          <div className="flex items-center gap-2">
            <Switch
              checked={tile.is_active}
              disabled={pending}
              onCheckedChange={(checked) => onSave({ is_active: checked })}
              aria-label={`Show ${tile.title ?? "tile"}`}
            />
            <span className="text-xs text-muted-foreground">
              {tile.is_active ? "Shown" : "Hidden"}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive"
            disabled={pending}
            onClick={onDelete}
            aria-label={`Delete ${tile.title ?? "tile"}`}
          >
            <Trash2Icon />
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}
