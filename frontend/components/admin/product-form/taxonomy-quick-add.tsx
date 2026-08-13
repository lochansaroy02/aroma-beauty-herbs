"use client";

import { CheckIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { FieldError } from "@/components/admin/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBrandAction,
  createCategoryAction,
  type TaxonomyOption,
} from "@/lib/taxonomy-actions";

type Props = {
  kind: "brand" | "category";
  label: string;
  value: string;
  options: TaxonomyOption[];
  disabled?: boolean;
  errors?: string[];
  onChange: (value: string) => void;
  /** Lets the parent merge the new row into its option list. */
  onCreated: (option: TaxonomyOption) => void;
};

/**
 * Select plus an inline "+ Add".
 *
 * Inline rather than a nested Dialog: stacking two Base UI dialogs is a
 * focus-trap and portal-ordering fight for the sake of one text field.
 */
export function TaxonomyQuickAdd({
  kind,
  label,
  value,
  options,
  disabled = false,
  errors,
  onChange,
  onCreated,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const labelFor = (id: string) =>
    options.find((option) => String(option.id) === id)?.name ?? `Select ${kind}…`;

  function cancel() {
    setAdding(false);
    setName("");
    setError(null);
  }

  function save() {
    const trimmed = name.trim();

    if (trimmed.length < 2) {
      setError("Give it a name of at least 2 characters");
      return;
    }

    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result =
        kind === "brand"
          ? await createBrandAction(trimmed)
          : await createCategoryAction(trimmed);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // An existing row is already in the options; only a genuinely new one
      // needs adding.
      if (!result.existed) onCreated(result.option);

      onChange(String(result.option.id));
      setNotice(
        result.existed ? `"${result.option.name}" already existed — selected it.` : null
      );
      cancel();
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${kind}-select`}>
          {label} <span className="text-destructive">*</span>
        </Label>

        {!adding ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-0.5 text-xs"
            disabled={disabled}
            onClick={() => setAdding(true)}
          >
            <PlusIcon className="size-3" />
            Add {kind}
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={`New ${kind} name`}
            maxLength={120}
            disabled={pending}
            onKeyDown={(event) => {
              // Enter would otherwise submit the whole product form.
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") cancel();
            }}
          />
          <Button type="button" size="icon" onClick={save} disabled={pending} aria-label="Save">
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={cancel}
            disabled={pending}
            aria-label="Cancel"
          >
            <XIcon />
          </Button>
        </div>
      ) : (
        <Select value={value} onValueChange={(next) => onChange(String(next))}>
          <SelectTrigger id={`${kind}-select`} className="w-full" disabled={disabled}>
            {/* Base UI renders the raw value unless given a formatter. */}
            <SelectValue>{(current) => labelFor(String(current ?? ""))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={String(option.id)}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
      <FieldError messages={errors} />
    </div>
  );
}
