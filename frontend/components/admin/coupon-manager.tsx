"use client";

import {
  AlertCircleIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  TicketPercentIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/lib/api";
import {
  createCouponAction,
  deleteCouponAction,
  toggleCouponAction,
  updateCouponAction,
} from "@/lib/admin-coupon-actions";
import {
  COUPON_TYPES,
  EMPTY_COUPON,
  couponToDraft,
  formatCouponDiscount,
  formatPrice,
  type Coupon,
  type CouponDraft,
  type CouponType,
} from "@/lib/catalog";

const VALIDITY = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

/** "∞" for an unset limit, which is what unlimited means here. */
function limit(value: number | null): string {
  return value === null ? "∞" : String(value);
}

function when(value: string | null): string {
  return value ? VALIDITY.format(new Date(value)) : "N/A";
}

export function CouponManager({ coupons }: { coupons: Coupon[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<CouponDraft>(EMPTY_COUPON);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Coupon | null>(null);
  const [pending, startTransition] = useTransition();

  function openNew() {
    setEditing(null);
    setDraft(EMPTY_COUPON);
    setFieldErrors({});
    setError(null);
    setOpen(true);
  }

  function openEdit(coupon: Coupon) {
    setEditing(coupon.id);
    setDraft(couponToDraft(coupon));
    setFieldErrors({});
    setError(null);
    setOpen(true);
  }

  function set<K extends keyof CouponDraft>(key: K, value: CouponDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result =
        editing === null
          ? await createCouponAction(draft)
          : await updateCouponAction(editing, draft);

      if (result.ok) {
        setOpen(false);
        setNotice(result.notice ?? "Saved.");
        return;
      }

      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  function toggle(coupon: Coupon, next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await toggleCouponAction(coupon.id, next);
      if (!result.ok) setError(result.error);
    });
  }

  function remove() {
    if (!confirming) return;
    setError(null);

    startTransition(async () => {
      const result = await deleteCouponAction(confirming.id);
      if (result.ok) {
        setConfirming(null);
        setNotice(result.notice ?? "Deleted.");
      } else setError(result.error);
    });
  }

  const message = (key: string) => fieldErrors[key]?.[0];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">All coupons</h1>
          <p className="text-sm text-muted-foreground">
            Discount codes shoppers can apply at checkout.
          </p>
        </div>

        <Button onClick={openNew}>
          <PlusIcon />
          Add coupon
        </Button>
      </div>

      {error && Object.keys(fieldErrors).length === 0 ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}

      {coupons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <TicketPercentIcon className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg">No coupons yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create one and shoppers can enter the code on the checkout page.
            </p>
            <Button className="mt-2" onClick={openNew}>
              <PlusIcon />
              Add coupon
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          {/* Wide by nature, so it scrolls inside the card rather than the page. */}
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage limits</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Options</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {coupons.map((coupon, index) => (
                  <TableRow key={coupon.id} className="align-top">
                    <TableCell className="text-muted-foreground tabular-nums">
                      {index + 1}
                    </TableCell>

                    <TableCell className="font-medium">{coupon.name}</TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {coupon.code}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatCouponDiscount(coupon)}
                    </TableCell>

                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      <div>Per coupon: {limit(coupon.usage_limit_per_coupon)}</div>
                      <div>Per user: {limit(coupon.usage_limit_per_user)}</div>
                      {coupon.usage_count > 0 ? (
                        <div className="mt-0.5 text-xs">Used {coupon.usage_count}×</div>
                      ) : null}
                    </TableCell>

                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      <div>Start: {when(coupon.start_date)}</div>
                      <div>End: {when(coupon.end_date)}</div>
                    </TableCell>

                    <TableCell>
                      <label className="flex cursor-pointer items-center gap-2">
                        <Switch
                          checked={coupon.is_active}
                          disabled={pending}
                          onCheckedChange={(checked) => toggle(coupon, checked === true)}
                        />
                        <span className="text-sm">
                          {coupon.is_active ? "Active" : "Inactive"}
                        </span>
                      </label>
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${coupon.code}`}
                        onClick={() => openEdit(coupon)}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${coupon.code}`}
                        onClick={() => setConfirming(coupon)}
                      >
                        <Trash2Icon className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Add / edit ─────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editing === null ? "Add coupon" : "Edit coupon"}
            </DialogTitle>
            <DialogDescription>
              The code is what shoppers type at checkout; the title is for your own
              reference.
            </DialogDescription>
          </DialogHeader>

          <form
            id="coupon-form"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-name">
                Internal title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="coupon-name"
                required
                placeholder="e.g. Summer Sale 2026"
                value={draft.name}
                aria-invalid={message("name") ? true : undefined}
                onChange={(event) => set("name", event.target.value)}
              />
              {message("name") ? (
                <p className="text-xs text-destructive">{message("name")}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="coupon-code">
                Coupon code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="coupon-code"
                required
                placeholder="e.g. SUMMER20"
                // Stored uppercase, so show it that way while typing rather
                // than silently changing it on save.
                className="font-mono uppercase"
                value={draft.code}
                aria-invalid={message("code") ? true : undefined}
                onChange={(event) => set("code", event.target.value.toUpperCase())}
              />
              {message("code") ? (
                <p className="text-xs text-destructive">{message("code")}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="coupon-type">
                Discount type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={draft.type}
                onValueChange={(value) => set("type", String(value) as CouponType)}
              >
                <SelectTrigger id="coupon-type">
                  <SelectValue>
                    {(value) =>
                      COUPON_TYPES.find((o) => o.value === value)?.label ?? String(value)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COUPON_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="coupon-value">
                Discount value <span className="text-destructive">*</span>
              </Label>
              <Input
                id="coupon-value"
                required
                inputMode="decimal"
                placeholder={draft.type === "percent" ? "10" : "50"}
                value={draft.value}
                aria-invalid={message("value") ? true : undefined}
                onChange={(event) => set("value", event.target.value)}
              />
              {message("value") ? (
                <p className="text-xs text-destructive">{message("value")}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="coupon-min">Minimum spend (₹)</Label>
              <Input
                id="coupon-min"
                inputMode="decimal"
                placeholder="No minimum"
                value={draft.min_spend}
                aria-invalid={message("min_spend") ? true : undefined}
                onChange={(event) => set("min_spend", event.target.value)}
              />
              {message("min_spend") ? (
                <p className="text-xs text-destructive">{message("min_spend")}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="coupon-max">
                {draft.type === "percent" ? "Maximum discount (₹)" : "Maximum spend (₹)"}
              </Label>
              <Input
                id="coupon-max"
                inputMode="decimal"
                placeholder="No maximum"
                value={draft.max_spend}
                aria-invalid={message("max_spend") ? true : undefined}
                onChange={(event) => set("max_spend", event.target.value)}
              />
              {/* The same column means different things per type, and getting
                  this wrong is how "20% off up to ₹500" becomes unlimited. */}
              <p className="text-xs text-muted-foreground">
                {draft.type === "percent"
                  ? "The most this coupon can take off a single order."
                  : "Baskets above this can't use the coupon."}
              </p>
              {message("max_spend") ? (
                <p className="text-xs text-destructive">{message("max_spend")}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="coupon-limit-total">Usage limit per coupon</Label>
              <Input
                id="coupon-limit-total"
                inputMode="numeric"
                placeholder="Unlimited"
                value={draft.usage_limit_per_coupon}
                onChange={(event) => set("usage_limit_per_coupon", event.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="coupon-limit-user">Usage limit per user</Label>
              <Input
                id="coupon-limit-user"
                inputMode="numeric"
                placeholder="Unlimited"
                value={draft.usage_limit_per_user}
                onChange={(event) => set("usage_limit_per_user", event.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="coupon-start">Start date</Label>
              <Input
                id="coupon-start"
                type="datetime-local"
                value={draft.start_date}
                onChange={(event) => set("start_date", event.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="coupon-end">End date</Label>
              <Input
                id="coupon-end"
                type="datetime-local"
                value={draft.end_date}
                aria-invalid={message("end_date") ? true : undefined}
                onChange={(event) => set("end_date", event.target.value)}
              />
              {message("end_date") ? (
                <p className="text-xs text-destructive">{message("end_date")}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="coupon-description">Description (optional)</Label>
              <Textarea
                id="coupon-description"
                rows={3}
                placeholder="Brief description to show to users"
                value={draft.description}
                onChange={(event) => set("description", event.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-3">
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(checked) => set("is_active", checked === true)}
                />
                <span className="text-sm">
                  {draft.is_active ? "Active" : "Inactive"} — only active coupons can be
                  redeemed
                </span>
              </label>
            </div>
          </form>

          {error && Object.keys(fieldErrors).length === 0 ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="coupon-form" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ────────────────────────────────────────── */}
      <Dialog open={confirming !== null} onOpenChange={() => setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Delete this coupon?</DialogTitle>
            <DialogDescription>
              {confirming?.code} will stop working immediately. Orders already placed with
              it keep their discount.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Kept beside the table so the summary row can reuse the same money format. */
export { formatPrice };
