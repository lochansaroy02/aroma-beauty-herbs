"use client";

import { FilmIcon, Loader2Icon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { discardUploads } from "@/lib/media-actions";
import {
  ACCEPT_VIDEO_ATTRIBUTE,
  MAX_VIDEO_BYTES,
  UploadError,
  uploadMedia,
  validateUpload,
  type UploadedVideo,
} from "@/lib/media-upload";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  disabled?: boolean;
  onChange: (video: UploadedVideo | null) => void;
  /** Raised while the file is in flight, so the form can hold back submit. */
  onBusyChange?: (busy: boolean) => void;
};

type State = {
  /** Object URL of the local file, played back while and after uploading. */
  preview: string;
  name: string;
  size: number;
  uploaded?: UploadedVideo;
  error?: string;
};

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One video per section, so this is a single slot rather than a list: picking a
 * new file replaces whatever was there and discards the old upload.
 */
export function VideoUploadField({
  label = "Video file",
  disabled = false,
  onChange,
  onBusyChange,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State | null>(null);

  // Mirrors `state` so the async upload can compute the next value without a
  // functional updater — the parent must be told from an event, never from
  // inside a state updater or an effect.
  const stateRef = useRef<State | null>(null);

  useEffect(() => {
    const current = stateRef;
    // Without this the object URL leaks for as long as the page lives.
    return () => {
      if (current.current) URL.revokeObjectURL(current.current.preview);
    };
  }, []);

  function commit(next: State | null) {
    stateRef.current = next;
    setState(next);
    onChange(next?.uploaded ?? null);
    onBusyChange?.(Boolean(next && !next.uploaded && !next.error));
  }

  async function handleFile(file: File) {
    const previous = stateRef.current;
    const invalid = validateUpload(file, "video");

    const pending: State = {
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      ...(invalid ? { error: invalid } : {}),
    };

    commit(pending);

    // Replacing orphans whatever was uploaded before.
    if (previous) {
      URL.revokeObjectURL(previous.preview);
      if (previous.uploaded) void discardUploads([previous.uploaded.file_id]);
    }

    if (invalid) return;

    try {
      const uploaded = await uploadMedia(file, "video");
      // Guard against a slower earlier upload landing after a newer pick.
      if (stateRef.current?.preview !== pending.preview) return;
      commit({ ...pending, uploaded });
    } catch (error) {
      if (stateRef.current?.preview !== pending.preview) return;
      commit({
        ...pending,
        error: error instanceof UploadError ? error.message : "Upload failed. Try again.",
      });
    }
  }

  function clear() {
    const current = stateRef.current;
    if (current) {
      URL.revokeObjectURL(current.preview);
      if (current.uploaded) void discardUploads([current.uploaded.file_id]);
    }
    commit(null);
  }

  const uploading = Boolean(state && !state.uploaded && !state.error);

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT_VIDEO_ATTRIBUTE}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so picking the same file again still fires a change.
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      {state ? (
        <div
          className={cn(
            "grid gap-2 rounded-md border p-3",
            state.error && "border-destructive"
          )}
        >
          <video
            src={state.preview}
            controls
            preload="metadata"
            className={cn("w-full rounded bg-black", uploading && "opacity-50")}
          />

          <div className="flex items-center gap-2">
            <FilmIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">{state.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {megabytes(state.size)}
            </span>

            {uploading ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin" />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={clear}
                disabled={disabled}
                aria-label="Remove video"
              >
                <XIcon />
              </Button>
            )}
          </div>

          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="h-24 flex-col gap-1 border-dashed font-normal text-muted-foreground"
        >
          <FilmIcon className="size-5" />
          Choose a video
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        MP4, WebM or MOV, up to {Math.round(MAX_VIDEO_BYTES / (1024 * 1024))}MB.
      </p>
    </div>
  );
}
