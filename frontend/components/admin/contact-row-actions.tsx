"use client";

import { AlertCircleIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteContactMessageAction,
  setContactStatusAction,
} from "@/lib/admin-contact-actions";
import { CONTACT_STATUSES, type ContactMessage, type ContactStatus } from "@/lib/catalog";

function labelFor(value: string): string {
  return CONTACT_STATUSES.find((option) => option.value === value)?.label ?? value;
}

/**
 * The per-row status dropdown.
 *
 * Optimistic: the select shows the new value immediately and rolls back if the
 * server refuses. Triaging a list means changing several in a row, and waiting
 * for a round trip on each one makes that feel broken.
 */
export function ContactStatusSelect({ message }: { message: ContactMessage }) {
  const [status, setStatus] = useState<ContactStatus>(message.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: ContactStatus) {
    if (next === status || pending) return;

    const previous = status;
    setStatus(next);
    setError(null);

    startTransition(async () => {
      const result = await setContactStatusAction(message.id, next);
      if (!result.ok) {
        setStatus(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid gap-1">
      <Select
        value={status}
        onValueChange={(value) => change(String(value) as ContactStatus)}
        disabled={pending}
      >
        <SelectTrigger
          aria-label={`Status for ${message.name}`}
          className="w-full min-w-36"
        >
          {/* Base UI hands the raw value to the child, not the item's label. */}
          <SelectValue>{(value) => labelFor(String(value))}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CONTACT_STATUSES.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {pending ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" />
          Saving
        </span>
      ) : null}

      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

/**
 * Delete, behind a confirmation.
 *
 * There is no soft delete on this table and no undo, so a misplaced click on a
 * dense row of icons would lose the enquiry for good.
 */
export function ContactDeleteButton({ message }: { message: ContactMessage }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);

    startTransition(async () => {
      const result = await deleteContactMessageAction(message.id);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete the enquiry from ${message.name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Delete this enquiry?</DialogTitle>
            <DialogDescription>
              From {message.name} ({message.email}). This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
