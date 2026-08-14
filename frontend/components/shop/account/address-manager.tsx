"use client";

import {
  AlertCircleIcon,
  CheckIcon,
  Loader2Icon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from "@/lib/account-actions";
import { EMPTY_ADDRESS, type Address } from "@/lib/catalog";
import type { FieldErrors } from "@/lib/api";

type Draft = Omit<Address, "id">;

/** Fields in the order they're filled in, so tabbing follows the eye. */
const FIELDS: {
  name: keyof Draft;
  label: string;
  span?: boolean;
  optional?: boolean;
  type?: string;
  autoComplete?: string;
}[] = [
  { name: "address_title", label: "Label (Home, Office)", optional: true, span: true },
  { name: "first_name", label: "First name", autoComplete: "given-name" },
  { name: "last_name", label: "Last name", autoComplete: "family-name" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
  {
    name: "address_line_1",
    label: "Address",
    span: true,
    autoComplete: "address-line1",
  },
  {
    name: "address_line_2",
    label: "Apartment, suite (optional)",
    span: true,
    optional: true,
    autoComplete: "address-line2",
  },
  { name: "city", label: "City", autoComplete: "address-level2" },
  { name: "state", label: "State", autoComplete: "address-level1" },
  { name: "zip_code", label: "PIN code", autoComplete: "postal-code" },
  { name: "country", label: "Country", autoComplete: "country-name" },
];

/** The row minus its id — the form edits fields, the id travels separately. */
function toDraft(address: Address): Draft {
  return {
    address_title: address.address_title,
    first_name: address.first_name,
    last_name: address.last_name,
    email: address.email,
    phone: address.phone,
    address_line_1: address.address_line_1,
    address_line_2: address.address_line_2,
    city: address.city,
    state: address.state,
    zip_code: address.zip_code,
    country: address.country,
    is_default: address.is_default,
  };
}

function formatLines(address: Address): string {
  return [
    address.address_line_1,
    address.address_line_2,
    `${address.city}, ${address.state} ${address.zip_code}`,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The saved-addresses panel.
 *
 * One dialog serves both "add" and "edit" — the only difference is whether an
 * id is carried alongside the draft, so there is a single form to keep correct
 * rather than two that drift apart.
 */
export function AddressManager({ addresses }: { addresses: Address[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_ADDRESS);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);

  function openNew() {
    setEditing(null);
    setDraft({ ...EMPTY_ADDRESS, is_default: addresses.length === 0 });
    setFieldErrors({});
    setError(null);
    setOpen(true);
  }

  function openEdit(address: Address) {
    setEditing(address.id);
    setDraft(toDraft(address));
    setFieldErrors({});
    setError(null);
    setOpen(true);
  }

  function submit() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result =
        editing === null
          ? await createAddressAction(draft)
          : await updateAddressAction(editing, draft);

      if (result.ok) {
        setOpen(false);
        setNotice(result.notice ?? "Saved.");
        return;
      }

      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  function runOn(id: number, action: () => Promise<{ ok: boolean; error?: string; notice?: string }>) {
    setError(null);
    setBusyId(id);

    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      if (result.ok) setNotice(result.notice ?? "Done.");
      else setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
            Account
          </p>
          <h1 className="mt-2 font-heading text-3xl tracking-tight text-ink">
            My address
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            The default address is the one checkout fills in for you.
          </p>
        </div>

        <Button onClick={openNew}>
          <PlusIcon />
          Add address
        </Button>
      </div>

      {/* Suppressed when the dialog's fields already carry the specific reason. */}
      {error && Object.keys(fieldErrors).length === 0 ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <p className="text-sm text-ink-soft" role="status">
          {notice}
        </p>
      ) : null}

      {addresses.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-ink/15 bg-paper px-6 py-16 text-center">
          <MapPinIcon className="size-8 text-clay" aria-hidden />
          <p className="font-heading text-lg text-ink">No addresses saved</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Add one now, or tick “save this address” the next time you check out.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="grid gap-3 rounded-2xl border border-ink/10 bg-paper p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-lg leading-tight text-ink">
                    {address.address_title || `${address.first_name} ${address.last_name}`}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {address.first_name} {address.last_name}
                  </p>
                </div>

                {address.is_default ? (
                  <Badge className="shrink-0 gap-1">
                    <CheckIcon className="size-3" />
                    Default
                  </Badge>
                ) : null}
              </div>

              <p className="text-sm leading-relaxed text-ink-soft">
                {formatLines(address)}
              </p>
              <p className="text-sm text-ink-soft">{address.phone}</p>

              <div className="mt-1 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(address)}>
                  <PencilIcon />
                  Edit
                </Button>

                {!address.is_default ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => runOn(address.id, () => setDefaultAddressAction(address.id))}
                  >
                    {busyId === address.id && pending ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <CheckIcon />
                    )}
                    Make default
                  </Button>
                ) : null}

                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => runOn(address.id, () => deleteAddressAction(address.id))}
                >
                  <Trash2Icon />
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editing === null ? "Add address" : "Edit address"}
            </DialogTitle>
            <DialogDescription>
              Used for delivery and for the invoice.
            </DialogDescription>
          </DialogHeader>

          <form
            id="address-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {FIELDS.map((field) => {
              const messages = fieldErrors[field.name];

              return (
                <div
                  key={field.name}
                  className={`grid gap-1.5 ${field.span ? "sm:col-span-2" : ""}`}
                >
                  <Label htmlFor={`address-${field.name}`}>{field.label}</Label>
                  <Input
                    id={`address-${field.name}`}
                    type={field.type ?? "text"}
                    autoComplete={field.autoComplete}
                    required={!field.optional}
                    value={String(draft[field.name] ?? "")}
                    aria-invalid={messages ? true : undefined}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                  {messages?.length ? (
                    <p className="text-xs text-destructive">{messages[0]}</p>
                  ) : null}
                </div>
              );
            })}

            <div className="sm:col-span-2">
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={draft.is_default}
                  // The only address there is has to be the default; the API
                  // enforces that too, so the box would lie if it stayed off.
                  disabled={addresses.length === 0}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, is_default: checked === true }))
                  }
                />
                Use this as my default address
              </Label>
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="address-form" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {editing === null ? "Save address" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
