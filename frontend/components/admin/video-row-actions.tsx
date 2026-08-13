"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { deleteVideoAction, setVideoActiveAction } from "@/lib/video-actions";

type Props = {
  id: number;
  isActive: boolean;
  title: string;
};

export function VideoRowActions({ id, isActive, title }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(isActive);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync when the server sends a different answer than the local guess.
  const [lastActive, setLastActive] = useState(isActive);
  if (lastActive !== isActive) {
    setLastActive(isActive);
    setActive(isActive);
  }

  function toggle(next: boolean) {
    setActive(next);
    setError(null);

    startTransition(async () => {
      const result = await setVideoActiveAction(id, next);
      if (!result.ok) {
        setActive(!next);
        setError(result.error);
      }
    });
  }

  function remove() {
    setError(null);

    startTransition(async () => {
      const result = await deleteVideoAction(id);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`active-${id}`}
            checked={active}
            disabled={pending}
            onCheckedChange={(checked) => toggle(checked === true)}
          />
          <Label htmlFor={`active-${id}`} className="font-normal">
            Active
          </Label>
        </div>

        {confirming ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={remove}
              disabled={pending}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirming(true)}
            disabled={pending}
            aria-label={`Delete ${title}`}
            className="text-muted-foreground"
          >
            <Trash2Icon />
          </Button>
        )}
      </div>

      {confirming ? (
        <p className="text-xs text-muted-foreground">
          Deletes the file from disk too.
        </p>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
