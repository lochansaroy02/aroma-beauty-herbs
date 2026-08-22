"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

import { FieldError } from "@/components/admin/field-error";
import { VideoUploadField } from "@/components/admin/video-upload-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { discardUploads } from "@/lib/media-actions";
import type { UploadedVideo } from "@/lib/media-upload";
import { createVideoAction, type VideoResult } from "@/lib/video-actions";

export function AddVideoDialog() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<VideoResult | null>(null);

  const [active, setActive] = useState(true);
  const [video, setVideo] = useState<UploadedVideo | null>(null);
  const [uploading, setUploading] = useState(false);
  // Bumped on close to remount the uploader, clearing its preview.
  const [uploaderKey, setUploaderKey] = useState(0);

  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;
  const formError = result && !result.ok && !result.fieldErrors ? result.error : undefined;

  // Stable identity: the uploader calls this from its own handlers.
  const handleVideoChange = useCallback((next: UploadedVideo | null) => {
    setVideo(next);
  }, []);

  function reset({ keepVideo }: { keepVideo: boolean }) {
    formRef.current?.reset();
    setActive(true);
    setResult(null);

    // An abandoned upload would otherwise sit in the media library forever.
    if (!keepVideo && video) void discardUploads([video.file_id]);

    setVideo(null);
    setUploading(false);
    setUploaderKey((key) => key + 1);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset({ keepVideo: false });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!video) {
      setResult({ ok: false, error: "Choose a video file first." });
      return;
    }

    const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();

    startTransition(async () => {
      const response = await createVideoAction({
        title,
        video,
        isActive: active,
      });

      setResult(response);

      if (response.ok) {
        // The video now belongs to a section — don't clean it up.
        setOpen(false);
        reset({ keepVideo: true });
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Upload video
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Upload video</DialogTitle>
          <DialogDescription>
            The active video with the lowest order becomes the homepage hero.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required autoFocus maxLength={180} />
            <FieldError messages={fieldErrors?.title} />
          </div>

          <VideoUploadField
            key={uploaderKey}
            disabled={pending}
            onChange={handleVideoChange}
            onBusyChange={setUploading}
          />
          <FieldError messages={fieldErrors?.video} />

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={active}
              onCheckedChange={(checked) => setActive(checked === true)}
            />
            <Label htmlFor="is_active" className="font-normal">
              Active
            </Label>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending || uploading || !video}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {uploading ? "Uploading…" : pending ? "Saving…" : "Save video"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
